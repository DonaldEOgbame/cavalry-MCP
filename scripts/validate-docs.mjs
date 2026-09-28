#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const docs = (await readdir(new URL('../docs', import.meta.url), { recursive: true }))
  .filter((file) => file.endsWith('.md'))
  .map((file) => `docs/${file}`);
const files = ['README.md', 'SUPPORTED.md', ...docs];
const texts = await Promise.all(files.map(async (file) => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')]));
const combined = texts.map(([, text]) => text).join('\n');
for (const match of combined.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
  if (!pkg.scripts[match[1]]) throw new Error(`Documentation references missing npm script: ${match[1]}`);
}
for (const required of ['CAVALRY_TOOL_PROFILE', 'CAVALRY_SECURITY_TIER', 'CAVALRY_ALLOW_RAW_SCRIPT', 'CAVALRY_BRIDGE_TIMEOUT_MS']) {
  if (!combined.includes(required)) throw new Error(`Documentation is missing environment variable ${required}`);
}
for (const tier of ['SAFE', 'EXTENDED', 'RAW', 'SYSTEM_EXEC']) {
  if (!combined.includes(tier)) throw new Error(`Documentation is missing security tier ${tier}`);
}
if (!combined.includes('403')) throw new Error('Documentation is missing the canonical full-profile tool count (403).');
if (!combined.includes('2.7.2')) throw new Error('Documentation is missing the minimum tested Cavalry version (2.7.2).');
process.stdout.write(`Validated ${files.length} documentation files against package scripts and runtime policy.\n`);
