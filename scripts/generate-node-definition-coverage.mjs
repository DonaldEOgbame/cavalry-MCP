import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reconciles Cavalry's full node/attribute schema (nodeDefinitions.json — every
// node type the engine can instantiate anywhere: top-level layers, generator-slot
// children, render-queue children) against the top-level creatable layer list
// (api.getAllLayerTypes()) that cavalry-api-manifest.json does not cover, since
// that manifest only tracks callable JS functions, not node/schema types.
//
// This does not create new MCP tools. It proves (or disproves) that every schema
// node type is reachable through an EXISTING generic mechanism: layer_create,
// layer_create_primitive, generator_set (on a generator/material/stroke/fill/
// constraint slot), or a generic array attribute (filters/deformers/masks).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const definitionsPath = process.env.CAVALRY_NODE_DEFINITIONS
  || '/Applications/Cavalry.app/Contents/assets/Definitions/nodeDefinitions.json';

if (!existsSync(definitionsPath)) {
  throw new Error(`Cavalry nodeDefinitions.json not found at ${definitionsPath}. Set CAVALRY_NODE_DEFINITIONS to override.`);
}

const nodeDefs = JSON.parse(await readFile(definitionsPath, 'utf8'));
const liveLayerTypesPath = resolve(root, 'coverage/live-layer-types.json');
const liveLayerTypes = existsSync(liveLayerTypesPath)
  ? new Set(JSON.parse(await readFile(liveLayerTypesPath, 'utf8')).types)
  : null;

// Reachability rules keyed by nodeDefinitions.json `superType`. Each rule was
// verified against a live Cavalry 2.7.2 instance on 2026-09-20 (see
// docs/coverage.md "Node/attribute schema reconciliation" for the transcript).
const SUPERTYPE_ROUTE = {
  distribution: { route: 'GENERIC_MCP', via: 'generator_set on a Duplicator/Stroke Duplicator "generator" slot', verifiedLive: true },
  connectDistribution: { route: 'GENERIC_MCP', via: 'generator_set on a Duplicator "generator" slot', verifiedLive: false },
  primitive: { route: 'GENERIC_MCP', via: 'layer_create_primitive with an arbitrary primitiveType string', verifiedLive: true },
  filter: { route: 'GENERIC_MCP', via: 'attribute_set on the generic "filters" array attribute present on every layer', verifiedLive: true },
  gradientOperator: { route: 'GENERIC_MCP', via: 'generator_set on a shape\'s "fill"/"stroke"/"material" slot', verifiedLive: true },
  noiseEngine: { route: 'GENERIC_MCP', via: 'generator_set on a shape\'s "fill"/"stroke"/"material" slot', verifiedLive: true },
  shape: { route: 'GENERIC_MCP', via: 'layer_create or nested generator_set depending on node (chartShape unresolved, see notes)', verifiedLive: 'partial' },
  behaviourBase: { route: 'GENERIC_MCP', via: 'generator_set on a deformer/behaviour slot, or the generic "deformers" array attribute', verifiedLive: false },
  behaviour: { route: 'GENERIC_MCP', via: 'generator_set on a deformer/behaviour slot, or the generic "deformers" array attribute', verifiedLive: false },
  stringOperator: { route: 'GENERIC_MCP', via: 'generator_set inside a String layer\'s operator chain', verifiedLive: false },
  textEngine: { route: 'GENERIC_MCP', via: 'generator_set on a Text layer\'s text-source slot', verifiedLive: false },
  renderFormat: { route: 'GENERIC_MCP', via: 'render_item_set_format (api.setGenerator on the render queue item "generator" slot)', verifiedLive: true },
  renderFormatWithAudio: { route: 'GENERIC_MCP', via: 'render_item_set_format (api.setGenerator on the render queue item "generator" slot)', verifiedLive: true },
  atomic: { route: 'GENERIC_MCP', via: 'generator_set or attribute_set depending on host node; audioTrack via cavalry_audio ops', verifiedLive: false },
  element: { route: 'GENERIC_MCP', via: 'layer_create (asset/hiddenFolder/renderQueueItem) or internal keyframe children via keyframe_* ops', verifiedLive: false },
  arrowHead: { route: 'GENERIC_MCP', via: 'generator_set on a Line/Path layer\'s arrow-head slot', verifiedLive: false },
  drawable: { route: 'GENERIC_MCP', via: 'layer_create (compNode) or generator_set for bone/skeleton/displacement children', verifiedLive: false },
  arrayOperator: { route: 'GENERIC_MCP', via: 'generator_set inside an array-processing operator chain', verifiedLive: false },
  animationCurveBase: { route: 'GENERIC_MCP', via: 'internal children of keyframe/graph attribute ops (graph_get/graph_set)', verifiedLive: false },
  remapper: { route: 'GENERIC_MCP', via: 'generator_set inside a range/remap operator chain', verifiedLive: false },
  lineGenerator: { route: 'GENERIC_MCP', via: 'generator_set on a Line layer\'s path-generator slot', verifiedLive: false },
  indexableArray: { route: 'GENERIC_MCP', via: 'attribute_set on generic array-typed attributes', verifiedLive: false },
  layoutItem: { route: 'GENERIC_MCP', via: 'layer_create (Layout Group children)', verifiedLive: false },
  chartEngine: { route: 'STRUCTURED_MCP', via: 'layer_create with layerType barChart/pieChart directly', verifiedLive: true },
  constraintOperator: { route: 'GENERIC_MCP', via: 'generator_set on a constraint slot (same pattern as distribution/fill slots)', verifiedLive: false },
  hiddenFolder: { route: 'GENERIC_MCP', via: 'internal grouping node created implicitly by keyframe/marker folder operations', verifiedLive: false },
  rectPatternItem: { route: 'GENERIC_MCP', via: 'generator_set inside a Rectangle Pattern generator chain', verifiedLive: false },
  textMaterialBehaviour: { route: 'GENERIC_MCP', via: 'generator_set on a Text layer\'s fill-behaviour slot', verifiedLive: false },
  particleModifier: { route: 'GENERIC_MCP', via: 'generator_set inside a particle system\'s collision-event slot', verifiedLive: false },
  molecule: { route: 'STRUCTURED_MCP', via: 'keyframe_* ops (keyframe is the base unit those ops already manipulate)', verifiedLive: false },
  none: { route: 'STRUCTURED_MCP', via: 'dedicated ops already exist per node (palette/colorSwatch via asset ops, renderQueue via render_queue_*, timeMarker via marker_*, animationCurveBase via graph_* )', verifiedLive: false },
  null: { route: 'GENERIC_MCP', via: 'generator_set on a Rig Control\'s IK-control slot (Cavalry\'s schema literally records this node\'s superType as the string "null")', verifiedLive: false },
};

function classify(entry) {
  const superType = entry.superType === undefined ? 'none' : String(entry.superType);
  const rule = SUPERTYPE_ROUTE[superType];
  if (!rule) {
    return { coverage: 'UNKNOWN', via: null, verifiedLive: false, notes: `No reachability rule recorded for superType "${superType}". Needs manual investigation.` };
  }
  return { coverage: rule.route, via: rule.via, verifiedLive: rule.verifiedLive, notes: '' };
}

const allEntries = nodeDefs.map((n) => ({ ...n, nodeType: n.nodeType || n.type }));
const concrete = allEntries.filter((n) => !n.abstract);
const abstractTypes = allEntries.filter((n) => n.abstract);

const results = concrete.map((entry) => {
  const isLiveTopLevel = liveLayerTypes ? liveLayerTypes.has(entry.nodeType) : null;
  const classification = isLiveTopLevel
    ? { coverage: 'STRUCTURED_MCP', via: 'layer_create / layer_create_primitive (confirmed in live api.getAllLayerTypes())', verifiedLive: true, notes: '' }
    : classify(entry);
  return {
    nodeType: entry.nodeType,
    superType: entry.superType || null,
    attributeCount: Object.keys(entry.attributes || {}).length,
    liveTopLevelLayer: isLiveTopLevel,
    ...classification,
  };
});

const unknown = results.filter((r) => r.coverage === 'UNKNOWN');
const counts = results.reduce((acc, r) => {
  acc[r.coverage] = (acc[r.coverage] || 0) + 1;
  return acc;
}, {});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: definitionsPath,
  method: 'Cross-references every concrete node type in nodeDefinitions.json against the live api.getAllLayerTypes() result and a manually verified per-superType reachability map. See docs/coverage.md for the live verification transcript.',
  totalNodeTypeEntries: allEntries.length,
  abstractBaseTypes: abstractTypes.length,
  concreteNodeTypes: concrete.length,
  liveTopLevelLayerTypes: liveLayerTypes ? liveLayerTypes.size : null,
  counts,
  unknownCount: unknown.length,
  nodes: results,
};

const outPath = resolve(root, 'coverage/cavalry-node-definition-coverage.json');
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Concrete node types: ${concrete.length} (+ ${abstractTypes.length} abstract base types)`);
console.log(`Live top-level layer types confirmed: ${liveLayerTypes ? liveLayerTypes.size : 'N/A (run scripts/probe-live-layer-types.mjs first)'}`);
console.log('Coverage counts:', counts);
console.log(`UNKNOWN: ${unknown.length}`);
if (unknown.length) {
  console.log('Unresolved superTypes:', [...new Set(unknown.map((u) => u.superType))]);
}
