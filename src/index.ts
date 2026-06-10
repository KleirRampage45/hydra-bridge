#!/usr/bin/env node
import { connectToHydra } from './hydra-cdp';
import { runMCPServer } from './mcp-server';

async function main() {
  const cdp = await connectToHydra();
  try {
    await runMCPServer(cdp);
  } catch (error) {
    console.error('[Main] Fatal error:', error);
    await cdp.close();
    process.exit(1);
  }
}

main().catch(console.error);
