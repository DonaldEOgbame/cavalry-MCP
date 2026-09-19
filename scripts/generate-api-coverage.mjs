import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const metadataRoot = process.env.CAVALRY_API_METADATA
  || '/Applications/Cavalry.app/Contents/assets/MetaData';

if (!existsSync(metadataRoot)) {
  throw new Error(`Cavalry API metadata not found at ${metadataRoot}. Set CAVALRY_API_METADATA to the installed metadata directory or JSON file.`);
}

const metadataPaths = metadataRoot.endsWith('.json')
  ? [metadataRoot]
  : ['api_function_metadata.json', 'core_api_function_metadata.json', 'gui_api_function_metadata.json', 'widget_api_function_metadata.json']
      .map((name) => resolve(metadataRoot, name)).filter(existsSync);
const metadata = (await Promise.all(metadataPaths.map(async (path) => JSON.parse(await readFile(path, 'utf8'))))).flat();
const bridge = await readFile(resolve(root, 'cavalry/bridge.js'), 'utf8');
const directlyUsed = new Set([...bridge.matchAll(/\b(?:api|ui)\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]));
const byName = new Map();
for (const entry of metadata) {
  if (entry.type !== 'function' || !entry.name) continue;
  const current = byName.get(entry.name) || { name: entry.name, namespaces: new Set(), descriptions: new Set() };
  if (entry.namespace) current.namespaces.add(entry.namespace);
  if (entry.description) current.descriptions.add(entry.description);
  byName.set(entry.name, current);
}

const methods = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)).map((entry) => {
  const namespaces = [...entry.namespaces].sort();
  if (directlyUsed.has(entry.name)) {
    return { method: entry.name, namespaces, status: 'covered', route: 'bridge', rationale: 'Called by a structured bridge operation.' };
  }
  if (namespaces.includes('@JS_GUI_API')) {
    return { method: entry.name, namespaces, status: 'covered', route: 'guarded_raw_script', rationale: 'Public GUI API remains reachable through the explicit opt-in raw-script escape hatch; no dedicated semantic tool is currently justified.' };
  }
  return { method: entry.name, namespaces, status: 'not relevant', rationale: 'This metadata entry is not part of the desktop @JS_GUI_API surface used by the Script UI bridge.' };
});

const counts = methods.reduce((acc, method) => {
  acc[method.status] = (acc[method.status] || 0) + 1;
  return acc;
}, {});
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  metadataPaths,
  discovered: methods.length,
  counts,
  unexplained: methods.filter((method) => method.status === 'missing').length,
  methods,
};

const output = resolve(root, 'coverage/cavalry-api-manifest.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Public Cavalry API methods discovered: ${report.discovered}`);
console.log(`Covered: ${counts.covered || 0}`);
console.log(`  Direct bridge: ${methods.filter((method) => method.route === 'bridge').length}`);
console.log(`  Guarded raw script: ${methods.filter((method) => method.route === 'guarded_raw_script').length}`);
console.log(`Missing: ${counts.missing || 0}`);
console.log(`Excluded with rationale: ${counts['not relevant'] || 0}`);
console.log(`Unexplained API functions: ${report.unexplained}`);
