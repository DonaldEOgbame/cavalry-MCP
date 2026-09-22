#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bridgeClient } from '../src/bridge/client.js';
import { recoverCavalryBridge } from '../src/bridge/watchdog.js';

const outputPath = resolve('coverage/live-watchdog-recovery-results.json');
await mkdir(resolve('coverage'), { recursive: true });
const before = await bridgeClient.send<any>('scene_checkpoint', {}, 10_000);
if (!before.ok || !before.result?.data) throw new Error('Could not capture a pre-restart checkpoint.');

const started = Date.now();
const restarted = await recoverCavalryBridge();
if (!restarted) throw new Error('Watchdog did not restore bridge connectivity.');
const restored = await bridgeClient.send<any>('scene_restore_checkpoint', { data: before.result.data }, 20_000);
const health = await bridgeClient.send<any>('cavalry_health', {}, 5_000);
const inspection = await bridgeClient.send<any>('scene_inspect', { detailed: false }, 10_000);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  cavalryVersion: '2.7.2',
  status: restored.ok && health.ok && inspection.ok ? 'PASS' : 'FAIL',
  processRestarted: restarted,
  bridgeHealthy: health.ok,
  checkpointRestored: restored.ok,
  sceneReadableAfterRestore: inspection.ok,
  durationMs: Date.now() - started,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
bridgeClient.stopCallbackServer();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'PASS') process.exitCode = 1;
