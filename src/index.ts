#!/usr/bin/env node

import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp/server.js';
import { logger } from './utils/logger.js';
import { bridgeClient } from './bridge/client.js';
import { shutdownRenderTracking } from './cavalry/rendering.js';

async function main() {
  logger.info('Initializing Cavalry MCP Server...');

  const server = createMcpServer();
  const transport = new StdioServerTransport();

  // Cleanup on process termination
  let shuttingDown = false;
  const cleanup = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down Cavalry MCP Server...');
    await shutdownRenderTracking();
    await bridgeClient.stopCallbackServer();
    process.exit(0);
  };

  process.on('SIGINT', () => { void cleanup(); });
  process.on('SIGTERM', () => { void cleanup(); });

  await server.connect(transport);
  logger.info('Cavalry MCP Server connected to stdio transport and ready.');
}

main().catch((err) => {
  logger.error('Fatal error starting Cavalry MCP Server', err);
  process.exit(1);
});
