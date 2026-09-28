import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const requiredMetadata = ['repository', 'homepage', 'bugs', 'engines', 'keywords', 'license', 'exports', 'files'];
for (const key of requiredMetadata) if (!pkg[key]) throw new Error(`Missing package metadata: ${key}`);
for (const relative of ['dist/index.js', 'dist/index.d.ts', 'cavalry/bridge.js', 'LICENSE', 'README.md', 'scripts/doctor.mjs', 'knowledge/generated/knowledge-index.json', 'knowledge/generated/knowledge-index.json.sha256']) {
  await access(new URL(`../${relative}`, import.meta.url), constants.R_OK);
}
const forbidden = ['dpf', 'output', 'mcp_runner.ts', 'render_phase.ts', 'run_all.ts', 'run_all_phases.ts'];
for (const item of forbidden) {
  if (pkg.files.some((entry) => entry === item || entry.startsWith(`${item}/`))) throw new Error(`Forbidden package entry: ${item}`);
}
process.stdout.write('Package metadata and required runtime files verified.\n');
