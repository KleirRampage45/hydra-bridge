import CDP from 'chrome-remote-interface';
import { ChildProcess, spawn } from 'child_process';
import { sleep } from './util';

const HYDRA_BIN = '/opt/Hydra/hydralauncher';
const CDP_PORT = 9222;

export interface HydraCDPClient {
  evaluate: (expression: string) => Promise<any>;
  close: () => Promise<void>;
  isConnected: () => boolean;
}

export async function connectToHydra(): Promise<HydraCDPClient> {
  let client: any = null;
  let hydraProcess: ChildProcess | null = null;

  // Check if Hydra is already running with CDP
  try {
    const resp = await fetch(`http://localhost:${CDP_PORT}/json/version`);
    if (resp.ok) {
      console.log('[HydraCDP] Existing Hydra CDP detected');
    }
  } catch {
    console.log('[HydraCDP] No existing CDP — starting Hydra...');
    hydraProcess = spawn(HYDRA_BIN, [
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-sandbox',
      '--disable-gpu',
    ], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DISPLAY: ':0' },
    });
    hydraProcess.unref();

    // Wait for CDP to come up
    let retries = 30;
    while (retries-- > 0) {
      try {
        const resp = await fetch(`http://localhost:${CDP_PORT}/json/version`);
        if (resp.ok) break;
      } catch {
        await sleep(1000);
      }
    }
    if (retries <= 0) throw new Error('Hydra failed to start CDP within 30s');
  }

  // Get the first page (main Hydra window)
  let pages: any[] = [];
  let pageRetries = 10;
  while (pageRetries-- > 0) {
    try {
      pages = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json() as any[];
      if (pages.length > 0 && pages[0]?.webSocketDebuggerUrl) break;
    } catch {
      // ignore
    }
    await sleep(1000);
  }
  const page = pages[0];
  if (!page?.webSocketDebuggerUrl) throw new Error('No Hydra page found');

  client = await CDP({ target: page.webSocketDebuggerUrl });

  // Test connection
  const test = await client.Runtime.evaluate({
    expression: 'window.electron.ping()',
    awaitPromise: true,
  });
  if (test.result?.value !== 'pong') {
    throw new Error('Hydra IPC test failed: ' + JSON.stringify(test));
  }
  console.log('[HydraCDP] Connected and IPC verified');

  return {
    evaluate: async (expression: string) => {
      const result = await client.Runtime.evaluate({
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(
          `JS Exception: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`
        );
      }
      return result.result?.value;
    },
    close: async () => {
      if (client) await client.close();
    },
    isConnected: () => !!client,
  };
}
