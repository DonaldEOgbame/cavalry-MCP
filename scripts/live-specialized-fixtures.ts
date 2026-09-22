#!/usr/bin/env node

import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createMcpServer } from '../src/mcp/server.js';
import { bridgeClient } from '../src/bridge/client.js';

type FinalStatus = 'PASS' | 'KNOWN_HOST_LIMITATION' | 'PLATFORM_LIMITATION';

interface Result {
  tool: string;
  status: FinalStatus;
  durationMs: number;
  fixture: string;
  assertion?: string;
  payload?: unknown;
  limitation?: string;
}

const root = resolve('coverage/specialized-fixtures');
const sequenceDir = resolve(root, 'image-sequence');
const smartFolderDir = resolve(root, 'smart-folder');
const sourcePng = resolve('coverage/compatibility/minimal.png');
const audioPath = resolve('coverage/fixtures/test-tone-440hz-1s.wav');
const reportPath = resolve('coverage/live-specialized-fixture-results.json');

await mkdir(sequenceDir, { recursive: true });
await mkdir(smartFolderDir, { recursive: true });
for (let frame = 1; frame <= 3; frame += 1) {
  await copyFile(sourcePng, resolve(sequenceDir, `fixture_${String(frame).padStart(4, '0')}.png`));
}
await copyFile(sourcePng, resolve(smartFolderDir, 'smart-folder-image.png'));

const server: any = createMcpServer();
const tools: Record<string, any> = server._registeredTools;
const results: Result[] = [];

function parse(response: any): any {
  const text = response?.content?.find((item: any) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : response;
}

async function call(tool: string, args: Record<string, unknown>): Promise<any> {
  const started = Date.now();
  const payload = parse(await tools[tool].handler(args, {}));
  if (!payload?.ok) {
    throw new Error(`${tool}: ${payload?.error?.message ?? 'unknown failure'}`);
  }
  results.push({ tool, status: 'PASS', durationMs: Date.now() - started, fixture: '', payload: payload.result });
  return payload.result;
}

function annotate(tool: string, fixture: string, assertion: string): void {
  const result = results.findLast((item) => item.tool === tool);
  assert.ok(result, `Missing result for ${tool}`);
  result.fixture = fixture;
  result.assertion = assertion;
}

try {
  await call('scene_new', { force: true });
  const comp = await call('composition_create', {
    name: 'Specialized Fixture Validation', width: 320, height: 180,
    fps: 30, startFrame: 0, endFrame: 30, makeActive: true,
  });

  const sequence = await call('asset_import', {
    filePath: resolve(sequenceDir, 'fixture_0001.png'), isSequence: true,
  });
  const sequenceInfo = await call('asset_sequence_inspect', { assetId: sequence.assetId });
  assert.equal(sequenceInfo.filePaths.length, 3);
  annotate('asset_sequence_inspect', sequenceDir, 'Cavalry returned all three numbered sequence frames.');

  const smartFolder = await call('asset_smart_folder_create', { path: smartFolderDir, assetType: 'image' });
  assert.ok(smartFolder.assetId);
  annotate('asset_smart_folder_create', smartFolderDir, 'Cavalry created a first-class Smart Folder asset.');
  const smartReload = await call('asset_smart_folder_reload', { assetId: smartFolder.assetId });
  assert.equal(smartReload.reloaded, true);
  annotate('asset_smart_folder_reload', smartFolderDir, 'The Smart Folder reloaded through the asset reload route.');

  const audioProbe = await call('audio_probe', { filePath: audioPath });
  assert.ok(audioProbe.durationSeconds > 0);
  annotate('audio_probe', audioPath, 'Local probe reported a positive duration for the deterministic WAV fixture.');

  const audio = await call('audio_import', { filePath: audioPath });
  assert.ok(audio.assetId);
  annotate('audio_import', audioPath, 'Cavalry imported the deterministic WAV as an asset.');

  const audioInspect = await call('audio_inspect', { assetId: audio.assetId });
  assert.equal(audioInspect.assetId, audio.assetId);
  annotate('audio_inspect', audioPath, 'The imported WAV asset was inspected by its live asset ID.');

  const footage = await call('audio_add_to_composition', { assetId: audio.assetId });
  const footageId = footage.footageLayer?.layerId ?? footage.footageLayer?.uuid;
  assert.ok(footageId);
  annotate('audio_add_to_composition', audioPath, 'The WAV asset produced a live footage layer.');

  await call('audio_set_offset', { footageLayerId: footageId, frameOffset: 2 });
  annotate('audio_set_offset', audioPath, 'The audio footage timeOffset was set to frame 2.');
  await call('audio_set_in_out', { footageLayerId: footageId, inFrame: 2, outFrame: 28 });
  annotate('audio_set_in_out', audioPath, 'The live audio footage in/out range was set and accepted.');
  await call('audio_set_volume', { footageLayerId: footageId, volume: 0.5 });
  annotate('audio_set_volume', audioPath, 'The live audio footage volume was set to 0.5.');

  const inspectedFootage = await call('layer_inspect', { layerId: footageId, includeAttributes: true });
  assert.equal(inspectedFootage.inFrame, 2);
  // Cavalry reports the exclusive layer boundary, hence requested frame 28 is
  // represented as outFrame 29 in layer inspection.
  assert.equal(inspectedFootage.outFrame, 29);
  const offset = await call('attribute_get', { layerId: footageId, attrPath: 'frameOffset' });
  const volume = await call('attribute_get', { layerId: footageId, attrPath: 'playbackVolume' });
  assert.equal(offset.value, 2);
  assert.equal(volume.value, 0.5);

  // Cavalry exposes inspection/replacement for existing Google Sheet assets,
  // but its only constructor is loadGoogleSheet(), which needs an externally
  // reachable spreadsheet ID. A local deterministic fixture cannot represent
  // that asset type, so these routes are classified rather than left untested.
  for (const tool of ['asset_google_sheet_inspect', 'asset_google_sheet_replace']) {
    results.push({
      tool,
      status: 'PLATFORM_LIMITATION',
      durationMs: 0,
      fixture: 'external Google Sheets service',
      limitation: 'Cavalry 2.7.2 requires an externally reachable Google Sheet asset; no local/offline constructor exists. A credentialed or public spreadsheet fixture is required for a valid mutation test.',
    });
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    host: { cavalryVersion: '2.7.2', platform: process.platform },
    compositionId: comp.compId ?? comp.layerId,
    counts: results.reduce<Record<FinalStatus, number>>((acc, result) => {
      acc[result.status] += 1;
      return acc;
    }, { PASS: 0, KNOWN_HOST_LIMITATION: 0, PLATFORM_LIMITATION: 0 }),
    results,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  // Read back the persisted report so a truncated/failed write cannot be
  // mistaken for completed evidence.
  const persisted = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(persisted.results.length, results.length);
  process.stdout.write(`${JSON.stringify({ reportPath, counts: report.counts }, null, 2)}\n`);
} finally {
  bridgeClient.stopCallbackServer();
}
