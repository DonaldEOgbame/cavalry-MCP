#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import * as Attr from '../src/cavalry/attributes.js';
import * as Anim from '../src/cavalry/animation.js';
import * as Preview from '../src/preview/frames.js';
import { bridgeClient } from '../src/bridge/client.js';

const execFileAsync = promisify(execFile);
const ROOT = resolve('coverage/soak');
const scenePath = resolve(ROOT, 'soak-current.cv');
const previewPath = resolve(ROOT, 'soak-current.png');
const cycles = Number(process.env.CAVALRY_SOAK_CYCLES ?? 100);

async function processMetrics() {
  const { stdout } = await execFileAsync('pgrep', ['-x', 'Cavalry']);
  const pid = stdout.trim().split(/\s+/)[0];
  const ps = await execFileAsync('ps', ['-o', 'rss=', '-p', pid]);
  let handles: number | null = null;
  try { handles = (await execFileAsync('/usr/sbin/lsof', ['-p', pid])).stdout.trim().split('\n').length - 1; } catch {}
  return { pid: Number(pid), rssKb: Number(ps.stdout.trim()), handles };
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

await mkdir(ROOT, { recursive: true });
const beforeFiles = (await readdir(ROOT)).length;
const initialMetrics = await processMetrics();
const samples: any[] = [];
const failures: any[] = [];
try {
  for (let index = 1; index <= cycles; index++) {
    const started = Date.now();
    try {
      await Scene.sceneNew(true);
      await Comp.compositionCreate({ name: `Soak ${index}`, width: 160, height: 90, fps: 30, startFrame: 0, endFrame: 10 });
      const shape = await Layer.layerCreatePrimitive(index % 2 ? 'ellipse' : 'rectangle', `Soak Shape ${index}`);
      await Attr.attributeSetMany(shape.layerId, { position: { x: index % 21 - 10, y: index % 11 - 5 }, 'material.materialColor': index % 2 ? '#55e6c1' : '#ffcb6b' });
      await Anim.keyframeCreate(shape.layerId, 'opacity', 0, 0);
      await Anim.keyframeCreate(shape.layerId, 'opacity', 5, 100);
      await Scene.sceneSaveAs(scenePath);
      await Scene.sceneOpen(scenePath, true);
      const reopened = await Layer.layerFind({ name: `Soak Shape ${index}` });
      assert.equal(reopened.count, 1);
      await Preview.previewFrame(5, 25, previewPath);
      assert.ok((await stat(previewPath)).size > 0);
      const metrics = index === 1 || index % 10 === 0 || index === cycles ? await processMetrics() : undefined;
      samples.push({ cycle: index, durationMs: Date.now() - started, metrics });
      if (index % 10 === 0) process.stdout.write(`cycle ${index}/${cycles}\n`);
    } catch (error) {
      failures.push({ cycle: index, error: error instanceof Error ? error.message : String(error) });
      break;
    }
  }
} finally {
  bridgeClient.stopCallbackServer();
}
const finalMetrics = await processMetrics();
const afterFiles = (await readdir(ROOT)).length;
const durations = samples.map((sample) => sample.durationMs);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  requestedCycles: cycles,
  completedCycles: samples.length,
  failures,
  latencyMs: { min: Math.min(...durations), p50: percentile(durations, 0.5), p95: percentile(durations, 0.95), max: Math.max(...durations), average: durations.reduce((a, b) => a + b, 0) / durations.length },
  resources: { initial: initialMetrics, final: finalMetrics, rssGrowthKb: finalMetrics.rssKb - initialMetrics.rssKb, handleGrowth: initialMetrics.handles == null || finalMetrics.handles == null ? null : finalMetrics.handles - initialMetrics.handles, trackedDirectoryFileGrowth: afterFiles - beforeFiles },
  artifacts: { scenePath, previewPath },
  samples,
  passed: samples.length === cycles && failures.length === 0,
};
await writeFile(resolve('coverage/live-soak-results.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ completedCycles: report.completedCycles, failures, latencyMs: report.latencyMs, resources: report.resources, passed: report.passed }, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
