import assert from 'node:assert/strict';
import { createMcpServer } from '../src/mcp/server.js';
import { runtimeToolRegistry } from '../src/mcp/tool-registry.js';

const iterations = Number(process.env.CAVALRY_TOOL_STRESS_ITERATIONS ?? 50);
const before = process.memoryUsage().heapUsed;
const previous = process.env.CAVALRY_TOOL_PROFILE;
for (let index = 0; index < iterations; index += 1) {
  process.env.CAVALRY_TOOL_PROFILE = index % 2 ? 'full' : 'core';
  createMcpServer();
  const active = runtimeToolRegistry.activeNames();
  if (index % 2) assert.equal(active.length, 385);
  else assert.ok(active.length < 385);
  assert.equal(new Set(runtimeToolRegistry.names()).size, 385);
}
if (previous === undefined) delete process.env.CAVALRY_TOOL_PROFILE; else process.env.CAVALRY_TOOL_PROFILE = previous;
const heapDeltaMb = (process.memoryUsage().heapUsed - before) / 1024 / 1024;
assert.ok(heapDeltaMb < Number(process.env.CAVALRY_TOOL_STRESS_MAX_HEAP_MB ?? 128), `heap grew by ${heapDeltaMb.toFixed(2)} MiB`);
process.stdout.write(`PASS ${iterations} alternating core/full registry initializations; heap delta ${heapDeltaMb.toFixed(2)} MiB.\n`);
