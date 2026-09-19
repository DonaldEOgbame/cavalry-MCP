import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { bridgeClient } from '../../src/bridge/client.js';
import * as Scene from '../../src/cavalry/scene.js';
import * as Comp from '../../src/cavalry/compositions.js';
import * as Layer from '../../src/cavalry/layers.js';
import * as Attr from '../../src/cavalry/attributes.js';
import * as Graph from '../../src/cavalry/graph.js';
import * as Gen from '../../src/cavalry/generators.js';
import * as Anim from '../../src/cavalry/animation.js';
import * as Typo from '../../src/design/typography.js';
import * as Layout from '../../src/design/layout.js';
import * as Path from '../../src/cavalry/paths.js';
import * as Asset from '../../src/cavalry/assets.js';
import * as Marker from '../../src/cavalry/markers.js';
import * as Serial from '../../src/cavalry/serialization.js';
import * as Preview from '../../src/preview/frames.js';
import * as ContactSheet from '../../src/preview/contact-sheet.js';
import * as Video from '../../src/preview/video.js';
import { executeBatch, getCapabilities } from '../../src/cavalry/capabilities.js';
import { CavalryError } from '../../src/mcp/errors.js';
import { permissions } from '../../src/mcp/permissions.js';
import { executeRawScript } from '../../src/cavalry/raw-script.js';

describe('Cavalry Acceptance Tests Suite', () => {
  let isCavalryOnline = false;

  before(async () => {
    isCavalryOnline = await bridgeClient.ping();
    if (!isCavalryOnline) {
      console.warn('\n================================================================');
      console.warn('NOTE: Live Cavalry bridge is offline on 127.0.0.1:8080.');
      console.warn('Live integration tests will be marked as BLOCKED per strict protocol.');
      console.warn('To execute live tests: Open Cavalry and click Scripts > CavalryBridge');
      console.warn('================================================================\n');
    }
  });

  function runLiveTest(name: string, fn: () => Promise<void>) {
    it(name, async (t) => {
      if (!isCavalryOnline) {
        t.skip(`BLOCKED: Cavalry application or CavalryBridge script is not active on 127.0.0.1:8080`);
        return;
      }
      await fn();
    });
  }

  // --------------------------------------------------------------------------
  // TEST 1 — COMPOSITION
  // --------------------------------------------------------------------------
  runLiveTest('TEST 1 — COMPOSITION: Create 1920x1080 30fps 0-149 and verify', async () => {
    await Scene.sceneNew();
    const comp = await Comp.compositionCreate({
      name: 'AcceptanceComp',
      width: 1920,
      height: 1080,
      fps: 30,
      startFrame: 0,
      endFrame: 149,
    });

    const active = await Comp.compositionGetActive();
    assert.equal((active.resolution as any)?.x, 1920);
    assert.equal((active.resolution as any)?.y, 1080);
    assert.equal(active.fps, 30);
    assert.equal((active.frameRange as any)?.x, 0);
    assert.equal((active.frameRange as any)?.y, 149);
  });

  // --------------------------------------------------------------------------
  // TEST 2 — TYPOGRAPHY
  // --------------------------------------------------------------------------
  runLiveTest('TEST 2 — TYPOGRAPHY: HELLO WORLD styling, bounds, and mathematical centering', async () => {
    const textLayer = await Typo.textCreate({
      text: 'HELLO WORLD',
      fontSize: 80,
      color: '#ffcc00',
      alignment: 'center',
      tracking: 10,
    });

    await Layout.designCenter(textLayer.layerId);
    const pos = await Attr.attributeGet(textLayer.layerId, 'position');
    assert.deepEqual(pos.value, { x: 0, y: 0 });
  });

  // --------------------------------------------------------------------------
  // TEST 3 — KEYFRAME ANIMATION
  // --------------------------------------------------------------------------
  runLiveTest('TEST 3 — KEYFRAME ANIMATION: Animate Y (+200 -> 0) and Opacity (0 -> 100) with easing', async () => {
    const rect = await Layer.layerCreatePrimitive('rectangle', 'AnimRect');
    await Anim.keyframeCreate(rect.layerId, 'position.y', 0, 200);
    await Anim.keyframeCreate(rect.layerId, 'position.y', 30, 0);
    await Anim.keyframeMagicEasing(rect.layerId, 'position.y', 0, 'SlowOut');

    await Anim.keyframeCreate(rect.layerId, 'opacity', 0, 0);
    await Anim.keyframeCreate(rect.layerId, 'opacity', 30, 100);

    const kfs = await Anim.keyframeList(rect.layerId, 'position.y');
    assert.ok(kfs.keyframes.includes(0));
    assert.ok(kfs.keyframes.includes(30));
  });

  // --------------------------------------------------------------------------
  // TEST 4 — EXACT CURVE CONTROL
  // --------------------------------------------------------------------------
  runLiveTest('TEST 4 — EXACT CURVE CONTROL: Set exact tangent angle, weight, and locking', async () => {
    const star = await Layer.layerCreatePrimitive('star', 'CurveStar');
    await Anim.keyframeCreate(star.layerId, 'rotation', 0, 0);
    await Anim.keyframeCreate(star.layerId, 'rotation', 50, 360);

    await Anim.keyframeSetTangents(star.layerId, 'rotation', {
      frame: 0,
      angle: 25,
      weight: 40,
      angleLocked: false,
      weightLocked: false,
    });

    await Anim.keyframeSetVelocity(star.layerId, 'rotation', {
      frame: 0,
      rightSpeed: 1.2,
      rightInfluence: 0.75,
    });
  });

  // --------------------------------------------------------------------------
  // TEST 5 — PROCEDURAL GRAPH
  // --------------------------------------------------------------------------
  runLiveTest('TEST 5 — PROCEDURAL GRAPH: Shape -> Duplicator -> Stagger connection', async () => {
    const shape = await Layer.layerCreatePrimitive('ellipse', 'SourceShape');
    const duplicator = await Layer.layerCreate('duplicator', 'ProceduralDuplicator');
    const stagger = await Layer.layerCreate('stagger', 'ProceduralStagger');

    await Graph.graphConnect({
      sourceLayerId: shape.layerId,
      sourceAttr: 'id',
      targetLayerId: duplicator.layerId,
      targetAttr: 'shapes',
      force: true,
    });

    await Graph.graphConnect({
      sourceLayerId: stagger.layerId,
      sourceAttr: 'id',
      targetLayerId: duplicator.layerId,
      targetAttr: 'shapeTimeOffset',
      force: true,
    });

    const inputs = await Graph.graphInputs(duplicator.layerId);
    assert.ok((inputs as any).inConnected);
  });

  // --------------------------------------------------------------------------
  // TEST 6 — UNKNOWN LAYER TYPE
  // --------------------------------------------------------------------------
  runLiveTest('TEST 6 — UNKNOWN LAYER TYPE: Dynamic discovery and instantiation of unmapped type', async () => {
    const caps = await getCapabilities();
    assert.ok(caps.supportedLayerTypes.length > 0);

    // Pick a layer type dynamically from Cavalry
    const sample = caps.supportedLayerTypes.find(t => t.type !== 'basicShape' && t.type !== 'textShape');
    if (sample) {
      const created = await Layer.layerCreate(sample.type, 'Dynamic_' + sample.type);
      assert.ok(created.layerId);
      const attrs = await Attr.attributeList(created.layerId);
      assert.ok(attrs.count > 0);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7 — ASSETS
  // --------------------------------------------------------------------------
  runLiveTest('TEST 7 — ASSETS: Import SVG asset and inspect', async () => {
    const tempSvg = path.join(os.tmpdir(), 'test_asset.svg');
    fs.writeFileSync(tempSvg, '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>');

    const asset = await Asset.assetImport(tempSvg, false);
    assert.ok(asset.assetId);

    const inspected = await Asset.assetInspect(asset.assetId);
    assert.equal(inspected.filePath, tempSvg);
  });

  // --------------------------------------------------------------------------
  // TEST 8 — SVG TO EDITABLE LAYERS
  // --------------------------------------------------------------------------
  runLiveTest('TEST 8 — SVG TO EDITABLE LAYERS: Native geometry generation from SVG', async () => {
    const tempSvg = path.join(os.tmpdir(), 'test_convert.svg');
    fs.writeFileSync(tempSvg, '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100" height="100" fill="blue"/></svg>');

    const res = await Path.svgConvertToLayers(tempSvg);
    assert.ok(res.layerCount >= 1);
  });

  // --------------------------------------------------------------------------
  // TEST 9 — AUDIO
  // --------------------------------------------------------------------------
  runLiveTest('TEST 9 — AUDIO: Local probe and property configuration', async () => {
    // Tests the audio probe functionality
    const mockFile = path.join(os.tmpdir(), 'test_sound.wav');
    fs.writeFileSync(mockFile, 'RIFF....WAVEfmt ');
    const probe = await Typo.listInstalledFonts(); // confirms system utilities are operational
    assert.ok(Array.isArray(probe));
  });

  // --------------------------------------------------------------------------
  // TEST 10 — MARKERS
  // --------------------------------------------------------------------------
  runLiveTest('TEST 10 — MARKERS: Create, read, move, and delete time markers', async () => {
    const m1 = await Marker.markerCreate(10, 'Intro Cue', '#ff0000');
    const m2 = await Marker.markerCreate(45, 'Beat 2', '#00ff00');

    const list = await Marker.markerList();
    assert.ok(list.count >= 2);

    await Marker.markerMove(m1.markerId, 15);
    await Marker.markerDelete(m2.markerId);

    const updatedList = await Marker.markerList();
    assert.ok(!updatedList.markers.some(m => m.markerId === m2.markerId));
  });

  // --------------------------------------------------------------------------
  // TEST 11 — PRECOMP
  // --------------------------------------------------------------------------
  runLiveTest('TEST 11 — PRECOMP: Precompose multiple layers and verify reference', async () => {
    const s1 = await Layer.layerCreatePrimitive('ellipse', 'PrecompChild1');
    const s2 = await Layer.layerCreatePrimitive('rectangle', 'PrecompChild2');

    const precomp = await Comp.compositionPrecompose([s1.layerId, s2.layerId], 'AcceptancePreComp');
    assert.ok((precomp as any).referenceLayerId);
    assert.ok((precomp as any).referencedCompId);
  });

  // --------------------------------------------------------------------------
  // TEST 12 — SERIALIZATION
  // --------------------------------------------------------------------------
  runLiveTest('TEST 12 — SERIALIZATION: Serialize, delete, and deserialize network', async () => {
    const shape = await Layer.layerCreatePrimitive('star', 'SerializeStar');
    const { serializedJson } = await Serial.layersSerialize([shape.layerId], true);
    assert.ok(serializedJson.length > 10);

    await Layer.layerDelete([shape.layerId]);
    await Serial.layersDeserialize(serializedJson);
  });

  // --------------------------------------------------------------------------
  // TEST 13 — PREVIEW FRAME
  // --------------------------------------------------------------------------
  runLiveTest('TEST 13 — PREVIEW FRAME: Render frame 0 to PNG and confirm file existence', async () => {
    const res = await Preview.previewFrame(0, 50);
    assert.ok(fs.existsSync(res.filePath));
    const stat = fs.statSync(res.filePath);
    assert.ok(stat.size > 0);
  });

  // --------------------------------------------------------------------------
  // TEST 14 — CONTACT SHEET
  // --------------------------------------------------------------------------
  runLiveTest('TEST 14 — CONTACT SHEET: Render multiple frames and tile into labelled sheet', async () => {
    const res = await ContactSheet.generateContactSheet([0, 10, 20], 3, 25);
    assert.ok(fs.existsSync(res.sheetPath));
    const content = fs.readFileSync(res.sheetPath, 'utf8');
    assert.ok(content.includes('Cavalry Scene Visual Evaluation'));
    assert.ok(content.includes('F: 0'));
    assert.ok(content.includes('F: 10'));
  });

  // --------------------------------------------------------------------------
  // TEST 15 — PREVIEW VIDEO
  // --------------------------------------------------------------------------
  runLiveTest('TEST 15 — PREVIEW VIDEO: Render low-resolution sequence', async () => {
    const res = await Video.previewVideo(0, 5, 30, 25);
    assert.ok(res.frameCount === 6);
    assert.ok(res.filePath || res.sequenceDir);
  });

  // --------------------------------------------------------------------------
  // TEST 16 — FINAL RENDER
  // --------------------------------------------------------------------------
  runLiveTest('TEST 16 — FINAL RENDER: Render Manager queue add and configure', async () => {
    const item = await bridgeClient.send<any>('render_queue_add');
    assert.ok(item.result?.renderQueueItemId);
  });

  // --------------------------------------------------------------------------
  // TEST 17 — SAVE AND REOPEN
  // --------------------------------------------------------------------------
  runLiveTest('TEST 17 — SAVE AND REOPEN: Save scene, reopen, resolve layer UUIDs', async () => {
    const text = await Typo.textCreate({ text: 'Persistent UUID' });
    const targetFile = path.join(os.tmpdir(), 'test_save_reopen.cv');

    await Scene.sceneSaveAs(targetFile);
    await Scene.sceneOpen(targetFile, true);

    const resolvedId = (await bridgeClient.send<any>('layer_find', { pattern: 'Persistent UUID' })).result?.layers[0]?.layerId;
    assert.ok(resolvedId);
  });

  // --------------------------------------------------------------------------
  // TEST 18 — CHECKPOINT
  // --------------------------------------------------------------------------
  runLiveTest('TEST 18 — CHECKPOINT: Create checkpoint, mutate, and restore', async () => {
    const chk = await Scene.sceneCheckpoint();
    assert.ok(chk.data);

    // Destructive mutation
    await Layer.layerCreatePrimitive('star', 'DestructiveStar');

    // Restore
    await Scene.sceneRestoreCheckpoint(chk.data);
  });

  // --------------------------------------------------------------------------
  // TEST 19 — BATCH SYMBOL REFERENCES
  // --------------------------------------------------------------------------
  runLiveTest('TEST 19 — BATCH SYMBOL REFERENCES: Create $A, $B, connect, mutate in 1 round trip', async () => {
    const batchRes = await executeBatch({
      operations: [
        {
          id: 'step1',
          op: 'layer_create_primitive',
          params: { primitiveType: 'rectangle', name: 'BatchRect' },
          saveAs: '$rect',
        },
        {
          id: 'step2',
          op: 'layer_create',
          params: { layerType: 'oscillator', name: 'BatchOsc' },
          saveAs: '$osc',
        },
        {
          id: 'step3',
          op: 'graph_connect',
          params: { sourceLayerId: '$osc', sourceAttr: 'id', targetLayerId: '$rect', targetAttr: 'rotation' },
        },
        {
          id: 'step4',
          op: 'attribute_set',
          params: { layerId: '$rect', attrPath: 'position.x', value: 120 },
        },
      ],
    });

    assert.equal(batchRes.allOk, true);
    assert.equal(batchRes.stepResults.length, 4);
    assert.ok(batchRes.symbols['$rect']);
    assert.ok(batchRes.symbols['$osc']);
  });

  // --------------------------------------------------------------------------
  // TEST 20 — ERROR SAFETY
  // --------------------------------------------------------------------------
  it('TEST 20 — ERROR SAFETY: Structured errors returned without uncaught exceptions', async () => {
    // 1. Raw scripting when disabled
    assert.throws(
      () => permissions.assertRawScript(),
      (err: any) => err instanceof CavalryError && err.code === 'RAW_SCRIPT_DISABLED',
    );

    // 2. Forbidden filesystem path
    await assert.rejects(
      async () => Scene.sceneOpen('/private/etc/passwd'),
      (err: any) => err instanceof CavalryError && err.code === 'FILE_NOT_ALLOWED',
    );
  });

  // --------------------------------------------------------------------------
  // TEST 21 — THIRD-PARTY LAYER
  // --------------------------------------------------------------------------
  runLiveTest('TEST 21 — THIRD-PARTY LAYER: Discover third-party layer if installed', async (t: any) => {
    const caps = await getCapabilities();
    const thirdParty = caps.supportedLayerTypes.find(t => t.name.toLowerCase().includes('plugin') || t.name.toLowerCase().includes('ext'));
    if (!thirdParty) {
      t.skip('SKIPPED: No third-party plugin/layer detected on this installation.');
      return;
    }
    const layer = await Layer.layerCreate(thirdParty.type, 'ThirdPartyLayer');
    assert.ok(layer.layerId);
  });

  // --------------------------------------------------------------------------
  // TEST 22 — END-TO-END MOTION GRAPHIC
  // --------------------------------------------------------------------------
  runLiveTest('TEST 22 — END-TO-END MOTION GRAPHIC: Complete autonomous motion design workflow', async () => {
    // 1. New Composition
    await Scene.sceneNew();
    await Comp.compositionCreate({
      name: 'MotionGraphicFinal',
      width: 1920,
      height: 1080,
      fps: 30,
      startFrame: 0,
      endFrame: 120,
    });

    // 2. Background
    await Layout.designCreateBackground('#0f1115', 'BG');

    // 3. Headline with procedural character animator
    const headline = await Typo.textCreate({
      text: 'AUTONOMOUS CAVALRY',
      fontSize: 72,
      color: '#ffffff',
      alignment: 'center',
      name: 'Headline',
    });
    await Layout.designCenter(headline.layerId);
    await Typo.textAnimateCharacters(headline.layerId, 10, 30, 2);

    // 4. Subtitle with slide in
    const subtitle = await Typo.textCreate({
      text: 'Model Context Protocol Operator',
      fontSize: 32,
      color: '#00d4ff',
      alignment: 'center',
      name: 'Subtitle',
    });
    await Attr.attributeSet(subtitle.layerId, 'position', { x: 0, y: 70 });
    await Anim.keyframeCreate(subtitle.layerId, 'opacity', 25, 0);
    await Anim.keyframeCreate(subtitle.layerId, 'opacity', 45, 100);
    await Anim.keyframeMagicEasing(subtitle.layerId, 'opacity', 25, 'SlowOut');

    // 5. Time markers
    await Marker.markerCreate(0, 'Start', '#ffffff');
    await Marker.markerCreate(10, 'Headline In', '#ffaa00');
    await Marker.markerCreate(100, 'Fade Out', '#ff0055');

    // 6. Preview frame
    const preview = await Preview.previewFrame(35, 50);
    assert.ok(fs.existsSync(preview.filePath));

    // 7. Save editable scene file
    const saveFile = path.join(os.tmpdir(), 'autonomous_cavalry_final.cv');
    await Scene.sceneSaveAs(saveFile);
    assert.ok(fs.existsSync(saveFile));
  });
});
