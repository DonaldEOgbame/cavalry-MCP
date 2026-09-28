#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const artifacts = ['coverage/mcp-tool-inventory.json', 'coverage/mcp-tool-contracts.json', 'coverage/mcp-tool-client.d.ts'];
const before = new Map(await Promise.all(artifacts.map(async (file) => [file, await readFile(file, 'utf8')])));

for (const script of ['coverage:tool-inventory', 'contracts:generate']) {
  const run = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
for (const file of artifacts) {
  if (await readFile(file, 'utf8') !== before.get(file)) throw new Error(`Generated artifact is stale or nondeterministic: ${file}`);
}
process.stdout.write('Generated tool artifacts are deterministic and current.\n');
