#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { createMcpServer } from '../src/mcp/server.js';
import { runtimeToolRegistry } from '../src/mcp/tool-registry.js';
import { packagePath } from '../src/utils/paths.js';

createMcpServer();
const definitions = runtimeToolRegistry.snapshot();
const contracts = definitions.map((definition) => ({
  name: definition.name,
  description: definition.description,
  inputSchema: z.toJSONSchema(z.object(definition.schema as z.ZodRawShape)),
}));

await mkdir(packagePath('coverage'), { recursive: true });
await writeFile(packagePath('coverage', 'mcp-tool-contracts.json'), `${JSON.stringify({ schemaVersion: 1, count: contracts.length, tools: contracts }, null, 2)}\n`);

const names = definitions.map((definition) => JSON.stringify(definition.name)).join(' |\n  ');
const declarations = `/** Generated from the canonical Cavalry MCP runtime registry. */\nexport type CavalryToolName =\n  ${names};\n\nexport interface CavalryToolClient {\n  call<TResult = unknown>(name: CavalryToolName, params?: Record<string, unknown>): Promise<TResult>;\n}\n`;
await writeFile(packagePath('coverage', 'mcp-tool-client.d.ts'), declarations);
process.stdout.write(`Generated ${contracts.length} tool contracts.\n`);

