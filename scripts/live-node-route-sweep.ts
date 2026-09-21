#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import { bridgeClient } from '../src/bridge/client.js';

const coveragePath = resolve('coverage/cavalry-node-definition-coverage.json');
const outputPath = resolve('coverage/live-node-route-sweep-results.json');

async function main() {
  const coverage = JSON.parse(await readFile(coveragePath, 'utf8'));
  const targets = coverage.nodes.filter((entry: any) => entry.verifiedLive === false);
  await Scene.sceneNew(true);
  await Comp.compositionCreate({ name: 'Node Route Verification', width: 320, height: 180, fps: 30, startFrame: 0, endFrame: 30 });

  const results: any[] = [];
  for (const target of targets) {
    const started = Date.now();
    try {
      const created = await Layer.layerCreate(target.nodeType, `Route Probe ${target.nodeType}`);
      const inspected = await Layer.layerInspect(created.layerId, true);
      await Layer.layerDelete(created.layerId);
      results.push({ nodeType: target.nodeType, superType: target.superType, status: 'PASS_DIRECT_CREATE', layerId: created.layerId, observedType: (inspected as any).type, durationMs: Date.now() - started });
    } catch (error) {
      results.push({ nodeType: target.nodeType, superType: target.superType, status: 'NEEDS_HOST_ROUTE', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - started });
    }
    process.stdout.write(`${results.at(-1).status} ${target.nodeType}\n`);
  }
  const summary = results.reduce((acc, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), targets: targets.length, summary, results }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1; }).finally(() => bridgeClient.stopCallbackServer());
