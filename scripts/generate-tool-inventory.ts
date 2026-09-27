#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createMcpServer } from '../src/mcp/server.js';
import { runtimeToolRegistry } from '../src/mcp/tool-registry.js';

createMcpServer();
const definitions = runtimeToolRegistry.snapshot();
const tools = definitions.map((definition) => definition.name);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  method: 'Canonical runtime tool registry populated by createMcpServer().',
  count: tools.length,
  tools,
};
await mkdir(resolve('coverage'), { recursive: true });
await writeFile(resolve('coverage/mcp-tool-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ count: tools.length }, null, 2)}\n`);
