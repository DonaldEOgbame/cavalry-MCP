#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createMcpServer } from '../src/mcp/server.js';

const server = createMcpServer() as any;
const registered = server._registeredTools ?? {};
const tools = Object.keys(registered).sort();
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  method: 'Runtime introspection of McpServer._registeredTools after createMcpServer().',
  count: tools.length,
  tools,
};
await mkdir(resolve('coverage'), { recursive: true });
await writeFile(resolve('coverage/mcp-tool-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ count: tools.length }, null, 2)}\n`);
