import { performance } from 'node:perf_hooks';
import { createMcpServer } from '../src/mcp/server.js';
import { runtimeToolRegistry } from '../src/mcp/tool-registry.js';
import { DocumentKnowledgeStore } from '../src/knowledge/store.js';

async function timed<T>(fn: () => T | Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}

const previous = process.env.CAVALRY_TOOL_PROFILE;
delete process.env.CAVALRY_TOOL_PROFILE;
const core = await timed(() => createMcpServer());
const coreTools = runtimeToolRegistry.activeNames().length;
process.env.CAVALRY_TOOL_PROFILE = 'full';
const full = await timed(() => createMcpServer());
const fullTools = runtimeToolRegistry.activeNames().length;
const knowledge = await timed(async () => (await new DocumentKnowledgeStore().all()).length);
if (previous === undefined) delete process.env.CAVALRY_TOOL_PROFILE; else process.env.CAVALRY_TOOL_PROFILE = previous;

const result = {
  node: process.versions.node,
  core: { startupMs: Number(core.ms.toFixed(2)), tools: coreTools },
  full: { startupMs: Number(full.ms.toFixed(2)), tools: fullTools },
  knowledge: { initializationMs: Number(knowledge.ms.toFixed(2)), records: knowledge.value },
  heapUsedMb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (process.argv.includes('--ci')) {
  const maxCore = Number(process.env.CAVALRY_BENCH_MAX_CORE_MS ?? 1500);
  const maxFull = Number(process.env.CAVALRY_BENCH_MAX_FULL_MS ?? 3000);
  const maxKnowledge = Number(process.env.CAVALRY_BENCH_MAX_KNOWLEDGE_MS ?? 5000);
  if (core.ms > maxCore || full.ms > maxFull || knowledge.ms > maxKnowledge) throw new Error(`Performance regression: thresholds core=${maxCore}ms full=${maxFull}ms knowledge=${maxKnowledge}ms`);
}
