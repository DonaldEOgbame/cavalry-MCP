#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as Scene from '../src/cavalry/scene.js';
import * as Comp from '../src/cavalry/compositions.js';
import * as Layer from '../src/cavalry/layers.js';
import * as Anim from '../src/cavalry/animation.js';
import * as Serial from '../src/cavalry/serialization.js';
import * as Preview from '../src/preview/frames.js';
import { bridgeClient } from '../src/bridge/client.js';
import { knowledgeEngine } from '../src/knowledge/engine.js';

const ROOT = resolve('knowledge/verified/components');
const PROJECT_ID = 'cavalry-2.7.2-component-library';
const specs = [
  { name: 'radial-wave', scene: '06-radial-duplication-wave', layers: ['Dot', 'Radial Duplicator', 'Clockwise Stagger'], description: 'Sixteen-copy radial Duplicator with a Circle Distribution and shared staggered entrance.', inputs: ['source color', 'copy count', 'radius', 'stagger range'], editable: ['material.materialColor', 'generator.count', 'generator.radius', 'minimum', 'maximum'], style: ['radial', 'procedural', 'staggered'] },
  { name: 'progress-indicator', scene: '21-progress-indicator', layers: ['Progress Bar', 'Progress Label'], description: 'Editable progress bar and label lockup with a verified normalized scale animation.', inputs: ['progress value', 'label text'], editable: ['scale.x', 'text', 'material.materialColor'], style: ['data motion', 'clean UI'] },
  { name: 'geometric-logo-assembly', scene: '20-logo-geometric-assembly', layers: ['Logo', 'Logo A', 'Logo B'], description: 'Parented geometric logo parts with shared entrance position and opacity timing.', inputs: ['part colors', 'entrance timing'], editable: ['position.y', 'opacity', 'material.materialColor'], style: ['logo motion', 'geometric'] },
];

await mkdir(ROOT, { recursive: true });
const results: any[] = [];
try {
  for (const spec of specs) {
    const source = resolve('knowledge/verified/golden-corpus', spec.scene, `${spec.scene}.cv`);
    await Scene.sceneOpen(source, true);
    const ids: string[] = [];
    for (const name of spec.layers) {
      const found = await Layer.layerFind({ name });
      const exact = found.layers.find((item) => item.name === name);
      if (exact && !ids.includes(exact.layerId)) ids.push(exact.layerId);
    }
    assert.ok(ids.length > 0, `${spec.name}: no export layers resolved`);
    await Layer.layerSelect(ids);
    const componentPath = resolve(ROOT, `${spec.name}.cvc`);
    const exported = await Serial.componentExport(componentPath);
    assert.equal(exported.exported, true);
    assert.ok((await stat(componentPath)).size > 0);

    await Scene.sceneNew(true);
    await Comp.compositionCreate({ name: `Component ${spec.name}`, width: 960, height: 540, fps: 30, startFrame: 0, endFrame: 90 });
    await Serial.componentImport(componentPath);
    const importedLayers = await Layer.layerList(false);
    assert.ok(importedLayers.count > 0, `${spec.name}: import created no layers`);
    await Anim.timelineSetFrame(30);
    const previewPath = resolve(ROOT, `${spec.name}.png`);
    await Preview.previewFrame(30, 50, previewPath);
    assert.ok((await stat(previewPath)).size > 0);
    const validationScene = resolve(ROOT, `${spec.name}-validation.cv`);
    await Scene.sceneSaveAs(validationScene);
    await Scene.sceneOpen(validationScene, true);
    assert.ok((await Layer.layerList(false)).count > 0, `${spec.name}: save/reopen lost component layers`);

    const component = {
      name: spec.name,
      path: componentPath,
      description: spec.description,
      requiredInputs: spec.inputs,
      exposedAttributes: spec.editable,
      aspectRatios: ['16:9'],
      expectedDurationFrames: 90,
      editableProperties: spec.editable,
      visualStyle: spec.style,
      limitations: ['Validated against Cavalry 2.7.2 on macOS.'],
    };
    const knowledgePath = resolve(ROOT, `${spec.name}.component.json`);
    await writeFile(knowledgePath, `${JSON.stringify(component, null, 2)}\n`);
    await knowledgeEngine.ingestion.ingestComponent(component, { scope: 'project', projectId: PROJECT_ID, cavalryVersion: '2.7.2', verified: true, source: componentPath });
    results.push({ name: spec.name, componentPath, previewPath, validationScene, importedLayerCount: importedLayers.count, status: 'VERIFIED' });
  }
  await writeFile(resolve(ROOT, 'validation.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  bridgeClient.stopCallbackServer();
}
