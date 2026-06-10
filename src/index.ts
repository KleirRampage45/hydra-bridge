#!/usr/bin/env node
import { connectToHydra } from './hydra-cdp';
import { runMCPServer } from './mcp-server';

async function main() {
  const cdp = await connectToHydra();

  // Clean up spawned Hydra on process exit
  const cleanup = async () => {
    console.log('[Main] Shutting down — cleaning up Hydra...');
    await cdp.close();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => { cdp.close(); });

  try {
    await runMCPServer(cdp);
  } catch (error) {
    console.error('[Main] Fatal error:', error);
    await cdp.close();
    process.exit(1);
  }
}

main().catch(console.error);
