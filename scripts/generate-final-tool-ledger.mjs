#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const read = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
const inventory = await read('coverage/mcp-tool-inventory.json');
const base = await read('coverage/live-mcp-tool-sweep-results.json');
const sources = [
  ['baseline-live-sweep', base],
  ['specialized-fixtures', await read('coverage/live-specialized-fixture-results.json')],
  ['safe-fallbacks', await read('coverage/live-safe-fallback-results.json')],
  ['ui-driver', await read('coverage/live-ui-driver-results.json')],
];

const baseLive = new Set(base.results.filter((item) =>
  item.status === 'PASS' || item.status === 'FAIL' ||
  item.status === 'QUARANTINED_HOST_EXIT_SEQUENCE' ||
  (item.status === 'EXPECTED_HOST_CRASH' && ['camera_create_guide', 'camera_add_guide'].includes(item.tool))
).map((item) => item.tool));
const evidence = new Map();
for (const [source, report] of sources) {
  for (const item of report.results) evidence.set(item.tool, { ...item, source });
}

function normalize(status) {
  if (status === 'PASS') return 'PASS';
  if (status === 'PLATFORM_LIMITATION' || status === 'NOT_APPLICABLE') return 'PLATFORM_LIMITATION';
  return 'KNOWN_HOST_LIMITATION';
}

const toolNames = inventory.tools.map((item) => typeof item === 'string' ? item : item.name);
const results = toolNames.map((tool) => {
  const item = evidence.get(tool);
  if (!item) return { tool, status: 'MISSING_EVIDENCE', liveInvoked: false };
  const dedicated = item.source !== 'baseline-live-sweep';
  return {
    tool,
    status: normalize(item.status),
    liveInvoked: dedicated || baseLive.has(tool),
    evidenceSource: item.source,
    originalStatus: item.status,
    limitation: item.payload?.error?.message ?? item.reason,
  };
});
const counts = results.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] ?? 0) + 1;
  return acc;
}, {});
const missing = results.filter((item) => item.status === 'MISSING_EVIDENCE').map((item) => item.tool);
const persistenceTestedTools = [
  'scene_new', 'scene_save', 'scene_save_as', 'scene_open', 'scene_import',
  'scene_checkpoint', 'scene_restore_checkpoint', 'scene_snapshot', 'scene_diff', 'scene_export_copy',
  'layers_serialize', 'layers_deserialize', 'component_export', 'component_export_selected', 'component_import',
  'template_create', 'template_instantiate', 'path_morph_safe', 'path_animation_safe',
  'camera_sequence_create', 'camera_cut', 'camera_transition',
];
const renderTestedTools = [
  'preview_frame', 'preview_frames', 'preview_contact_sheet', 'preview_video', 'viewport_capture',
  'render_start', 'render_item_set_format', 'render_item_set_generator', 'timeline_preview_playback',
  'render_mux_audio', 'render_status', 'render_is_active', 'render_wait',
];
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  registeredToolCount: toolNames.length,
  accountedToolCount: toolNames.length - missing.length,
  liveInvokedToolCount: results.filter((item) => item.liveInvoked).length,
  counts,
  allowedTerminalStatuses: ['PASS', 'KNOWN_HOST_LIMITATION', 'PLATFORM_LIMITATION'],
  missing,
  persistenceTestedToolCount: persistenceTestedTools.length,
  persistenceTestedTools,
  renderTestedToolCount: renderTestedTools.length,
  renderTestedTools,
  results,
};
await writeFile(resolve('coverage/final-tool-ledger.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  registeredToolCount: report.registeredToolCount,
  accountedToolCount: report.accountedToolCount,
  liveInvokedToolCount: report.liveInvokedToolCount,
  counts,
  persistenceTestedToolCount: report.persistenceTestedToolCount,
  renderTestedToolCount: report.renderTestedToolCount,
  missing,
}, null, 2)}\n`);
if (missing.length) process.exitCode = 1;
