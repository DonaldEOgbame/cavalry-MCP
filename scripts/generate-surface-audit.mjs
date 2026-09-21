import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const metadataRoot = process.env.CAVALRY_API_METADATA || '/Applications/Cavalry.app/Contents/assets/MetaData';
const definitionsPath = process.env.CAVALRY_NODE_DEFINITIONS || '/Applications/Cavalry.app/Contents/assets/Definitions/nodeDefinitions.json';
if (!existsSync(metadataRoot) || !existsSync(definitionsPath)) throw new Error('Installed Cavalry metadata/definitions were not found.');

const namespaceRuntime = {
  '@JS_GUI_API': 'api',
  '@JS_CORE_API': 'cavalry',
  '@JS_CTX': 'ctx',
  '@JS_DEFORMER': 'def',
  '@JS_WIDGET_API': 'ui',
};
const namespaceCoverage = {
  '@JS_GUI_API': { fallback: 'RAW_SCRIPT', availability: 'Script UI global api' },
  '@JS_CORE_API': { fallback: 'RAW_SCRIPT', availability: 'JavaScript Layer/expression global cavalry' },
  '@JS_CTX': { fallback: 'CONTEXT_ONLY', availability: 'JavaScript Layer evaluation context ctx' },
  '@JS_DEFORMER': { fallback: 'CONTEXT_ONLY', availability: 'JavaScript Deformer definition context def' },
  '@JS_WIDGET_API': { fallback: 'SCRIPT_UI', availability: 'Script UI global ui' },
};

const metadataFiles = (await readdir(metadataRoot)).filter((name) => name.endsWith('_function_metadata.json')).sort();
const metadata = (await Promise.all(metadataFiles.map(async (name) => JSON.parse(await readFile(resolve(metadataRoot, name), 'utf8'))))).flat();
const bridge = await readFile(resolve(root, 'cavalry/bridge.js'), 'utf8');
const server = await readFile(resolve(root, 'src/mcp/server.ts'), 'utf8');
const capabilities = JSON.parse(await readFile(resolve(root, 'coverage/cavalry-capabilities.json'), 'utf8'));
const manualFeatures = JSON.parse(await readFile(resolve(root, 'coverage/manual-editor-features.json'), 'utf8'));
const nodeCoverage = JSON.parse(await readFile(resolve(root, 'coverage/cavalry-node-definition-coverage.json'), 'utf8'));
const nodeDefinitions = JSON.parse(await readFile(definitionsPath, 'utf8'));

const referenced = Object.fromEntries(['api', 'cavalry', 'ctx', 'def', 'ui'].map((runtime) => [runtime,
  new Set([...bridge.matchAll(new RegExp(`\\b${runtime}\\.([A-Za-z_$][\\w$]*)`, 'g'))].map((match) => match[1])),
]));
const inventoryPath = resolve(root, 'coverage/mcp-tool-inventory.json');
const mcpTools = existsSync(inventoryPath)
  ? JSON.parse(await readFile(inventoryPath, 'utf8')).tools
  : [...server.matchAll(/server\.tool\('([^']+)'/g)].map((match) => match[1]).sort();
const mcpToolSet = new Set(mcpTools);

const apiSurface = metadata.map((entry) => {
  const runtime = namespaceRuntime[entry.namespace] || 'unknown';
  const usedByBridge = referenced[runtime]?.has(entry.name) || false;
  let coverage = namespaceCoverage[entry.namespace]?.fallback || 'UNKNOWN';
  if (usedByBridge && entry.namespace === '@JS_GUI_API') coverage = 'STRUCTURED';
  if (usedByBridge && entry.namespace === '@JS_WIDGET_API') coverage = 'SCRIPT_UI_BRIDGE';
  return {
    qualifiedName: `${runtime}.${entry.name}`,
    runtime,
    namespace: entry.namespace,
    kind: entry.type,
    callable: entry.type === 'function',
    coverage,
    usedByBridge,
    availability: namespaceCoverage[entry.namespace]?.availability || 'Unknown runtime surface',
    description: entry.description || '',
  };
}).sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));

const infrastructure = [
  { qualifiedName: 'api.WebServer', coverage: 'STRUCTURED', evidence: 'Bridge request server' },
  { qualifiedName: 'api.WebClient', coverage: 'STRUCTURED', evidence: 'Bridge callback client' },
  { qualifiedName: 'api.Timer', coverage: 'STRUCTURED', evidence: 'Bridge callback/event scheduling' },
  { qualifiedName: 'ui.addCallbackObject', coverage: 'SCRIPT_UI_BRIDGE', evidence: 'Native event callback registration' },
];
const callbacks = [...new Set([...bridge.matchAll(/\b(on[A-Z][A-Za-z0-9_$]+)\s*[:=(]/g)].map((match) => match[1]))].sort();

const capabilityRows = Object.entries(capabilities.capabilities).map(([name, value]) => {
  const tools = value.tools || [];
  const missingTools = tools.filter((tool) => !mcpToolSet.has(tool));
  return { name, coverage: value.coverage, tools, missingTools, notes: value.notes || '' };
});
const capabilityBreakdown = capabilityRows.reduce((acc, row) => {
  acc[row.coverage] = (acc[row.coverage] || 0) + 1;
  return acc;
}, {});
const apiBreakdown = apiSurface.reduce((acc, row) => {
  acc[row.coverage] = (acc[row.coverage] || 0) + 1;
  return acc;
}, {});
const namespaceBreakdown = apiSurface.reduce((acc, row) => {
  const item = acc[row.namespace] ||= { runtime: row.runtime, functions: 0, properties: 0, classes: 0, total: 0 };
  item.total += 1;
  if (row.kind === 'function') item.functions += 1;
  else if (row.kind === 'property') item.properties += 1;
  else if (row.kind === 'class') item.classes += 1;
  return acc;
}, {});

const unknown = [
  ...apiSurface.filter((row) => row.coverage === 'UNKNOWN').map((row) => row.qualifiedName),
  ...capabilityRows.filter((row) => row.coverage === 'UNKNOWN' || row.missingTools.length).map((row) => row.name),
  ...nodeCoverage.nodes.filter((row) => row.coverage === 'UNKNOWN').map((row) => row.nodeType),
];
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  cavalryVersion: capabilities.supportedCavalryVersion,
  sources: {
    metadataFiles: metadataFiles.map((name) => resolve(metadataRoot, name)),
    nodeDefinitions: definitionsPath,
    bridge: resolve(root, 'cavalry/bridge.js'),
    mcpServer: resolve(root, 'src/mcp/server.ts'),
  },
  counts: {
    mcpTools: mcpTools.length,
    callableApiMethodsUniqueByName: new Set(apiSurface.filter((row) => row.callable).map((row) => row.qualifiedName.replace(/^[^.]+\./, ''))).size,
    callableApiMethodsQualified: apiSurface.filter((row) => row.callable).length,
    apiProperties: apiSurface.filter((row) => row.kind === 'property').length,
    apiClasses: apiSurface.filter((row) => row.kind === 'class').length,
    concreteNodeTypes: nodeCoverage.concreteNodeTypes,
    nodeAttributes: nodeDefinitions.reduce((sum, entry) => sum + Object.keys(entry.attributes || {}).length, 0),
    concreteNodeAttributes: nodeDefinitions.filter((entry) => !entry.abstract).reduce((sum, entry) => sum + Object.keys(entry.attributes || {}).length, 0),
    capabilityGroups: capabilityRows.length,
    manualEditorFeatures: Object.keys(manualFeatures.features).length,
    callbacks: callbacks.length,
    unknown: unknown.length,
  },
  apiBreakdown,
  namespaceBreakdown,
  capabilityBreakdown,
  infrastructure,
  callbacks,
  capabilityGroups: capabilityRows,
  manualEditorFeatures: manualFeatures.features,
  apiSurface,
  unknown,
};

await mkdir(resolve(root, 'coverage'), { recursive: true });
await writeFile(resolve(root, 'coverage/cavalry-surface-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ counts: report.counts, apiBreakdown, namespaceBreakdown, capabilityBreakdown }, null, 2));
if (unknown.length) process.exitCode = 1;
