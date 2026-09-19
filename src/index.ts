#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server.js';
import { logger } from './utils/logger.js';
import { bridgeClient } from './bridge/client.js';

// Load environment variables if present
dotenv.config();

async function main() {
  logger.info('Initializing Cavalry MCP Server...');

  const server = createMcpServer();
  const transport = new StdioServerTransport();

  // Cleanup on process termination
  const cleanup = () => {
    logger.info('Shutting down Cavalry MCP Server...');
    bridgeClient.stopCallbackServer();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await server.connect(transport);
  logger.info('Cavalry MCP Server connected to stdio transport and ready.');
}

main().catch((err) => {
  logger.error('Fatal error starting Cavalry MCP Server', err);
  process.exit(1);
});
