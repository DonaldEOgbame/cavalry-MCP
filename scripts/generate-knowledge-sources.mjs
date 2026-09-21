import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('knowledge/sources/generated');
await mkdir(out, { recursive: true });
const definitions = JSON.parse(await readFile('/Applications/Cavalry.app/Contents/assets/Definitions/nodeDefinitions.json', 'utf8'));
const capabilities = JSON.parse(await readFile('coverage/cavalry-capabilities.json', 'utf8'));
const renders = JSON.parse(await readFile('coverage/render-formats.json', 'utf8'));
const audit = JSON.parse(await readFile('coverage/cavalry-surface-audit.json', 'utf8'));

const concreteDefinitions = definitions.filter((entry) => !entry.abstract && (entry.nodeType || entry.type)).map((entry) => ({ ...entry, nodeType: entry.nodeType || entry.type }));
const nodeLines = [
  '# Cavalry 2.7.2 Official Node Schema Reference',
  '',
  'Generated from the installed official `nodeDefinitions.json`. Attribute names and types are runtime schema evidence.',
  '',
];
for (const node of concreteDefinitions.sort((a, b) => a.nodeType.localeCompare(b.nodeType))) {
  nodeLines.push(`## ${node.nodeType}`, '', `Node identifier: ${node.nodeType}.`, `Supertype: ${node.superType ?? 'none'}.`);
  if (node.tags?.length) nodeLines.push(`Tags: ${node.tags.join(', ')}.`);
  const attrs = Object.entries(node.attributes || {});
  nodeLines.push(`Concrete attributes (${attrs.length}):`);
  for (const [name, definition] of attrs) {
    const d = definition || {};
    const details = [d.type && `type=${d.type}`, d.default !== undefined && `default=${JSON.stringify(d.default)}`, d.readOnly && 'read-only', d.keyable && 'keyable', d.connectable && 'connectable'].filter(Boolean);
    nodeLines.push(`- \`${name}\`${details.length ? ` — ${details.join(', ')}` : ''}`);
  }
  nodeLines.push('');
}
await writeFile(resolve(out, 'official-node-schema.md'), `${nodeLines.join('\n')}\n`);

const capabilityLines = ['# Cavalry 2.7.2 Capability Routes', '', 'Generated from the reconciled 62-group capability matrix.', ''];
for (const [name, value] of Object.entries(capabilities.capabilities)) {
  capabilityLines.push(`## ${name}`, '', `Capability identifier: ${name}.`, `Coverage: ${value.coverage}.`, value.tools?.length ? `MCP tools: ${value.tools.join(', ')}.` : 'MCP tools: none.', value.notes || '', '');
}
await writeFile(resolve(out, 'capability-routes.md'), `${capabilityLines.join('\n')}\n`);

const renderLines = ['# Cavalry 2.7.2 Render Formats', '', `Live result: ${renders.liveRenderValidation}.`, ''];
for (const [name, value] of Object.entries(renders.formats)) {
  renderLines.push(`## ${name}`, '', `Node type: ${value.nodeType}.`, `Live status: ${value.liveStatus ?? 'not swept'}.`, value.liveNotes || '', '');
}
await writeFile(resolve(out, 'render-formats.md'), `${renderLines.join('\n')}\n`);

const surfaceLines = ['# Cavalry Runtime Surface Inventory', '', 'Generated from all installed Cavalry metadata namespaces.', ''];
for (const [namespace, value] of Object.entries(audit.namespaceBreakdown)) {
  surfaceLines.push(`## ${namespace}`, '', `Runtime: ${value.runtime}. Functions: ${value.functions}. Properties: ${value.properties}. Classes: ${value.classes}.`, '');
}
for (const row of audit.apiSurface) {
  surfaceLines.push(`### ${row.qualifiedName}`, '', `Runtime identifier: ${row.qualifiedName}.`, `Kind: ${row.kind}. Coverage: ${row.coverage}. Availability: ${row.availability}.`, row.description || '', '');
}
await writeFile(resolve(out, 'runtime-surfaces.md'), `${surfaceLines.join('\n')}\n`);

console.log(JSON.stringify({ nodeSections: concreteDefinitions.length, capabilitySections: Object.keys(capabilities.capabilities).length, renderSections: Object.keys(renders.formats).length, runtimeEntries: audit.apiSurface.length }, null, 2));
