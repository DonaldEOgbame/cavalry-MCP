import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileMotionProject } from '../../src/motion/compiler.js';
import { createRuntime, semanticId } from '../../src/motion/store.js';
import { hydrateRuntime, persistRuntime, readPersistedState, resolveAgainstLiveScene, sceneSidecarPath, seedIndexFromNames, serializeRuntime } from '../../src/motion/persistence.js';
import { indexSceneLayers } from '../../src/motion/service.js';
import { MotionProjectSpec } from '../../src/motion/types.js';

function project(): MotionProjectSpec {
  return {
    id: 'persist-demo', name: 'Persist Demo', resolution: { width: 1920, height: 1080 }, fps: 30,
    scenes: [
      { id: 'scene-24', name: 'Hero', durationFrames: 60, background: '#000000', elements: [
        { id: 'hero_word', kind: 'text', text: 'MOVE', motions: [{ type: 'enterUp', durationFrames: 12 }] },
        { id: 'accent', kind: 'rectangle', width: 200, height: 20 },
      ] },
      { id: 'scene-25', durationFrames: 30, background: '#ffffff', elements: [{ id: 'hero_word', kind: 'text', text: 'FAST' }] },
    ],
  };
}

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function compiledRuntime() {
  const spec = project();
  const runtime = createRuntime(spec, compileMotionProject(spec));
  // Simulate the batch step results the bridge returns for a compile.
  indexSceneLayers(runtime, 'scene-24', { stepResults: [
    { id: 'scene-24-hero_word-create', op: 'layer_create', ok: true, result: { layerId: 'textShape#1', uuid: UUID(1), name: 'scene-24/hero_word' } },
    { id: 'scene-24-accent-create', op: 'layer_create_primitive', ok: true, result: { layerId: 'basicShape#2', uuid: UUID(2), name: 'scene-24/accent' } },
    { id: 'scene-24-background-create', op: 'layer_create_primitive', ok: true, result: { layerId: 'basicShape#3', uuid: UUID(3), name: 'Hero Background' } },
    { id: 'scene-24-headline-ease', op: 'keyframe_magic_easing', ok: true, result: {} },
  ] });
  indexSceneLayers(runtime, 'scene-25', { stepResults: [
    { id: 'scene-25-hero_word-create', op: 'layer_create', ok: true, result: { layerId: 'textShape#4', uuid: UUID(4), name: 'scene-25/hero_word' } },
    { id: 'scene-25-background-create', op: 'layer_create_primitive', ok: true, result: { layerId: 'basicShape#5', uuid: UUID(5), name: 'scene-25 Background' } },
  ] });
  runtime.dirtyScenes.clear();
  runtime.compiledHash = runtime.plan.hash;
  runtime.compId = 'compNode#1';
  runtime.revision = 7;
  return runtime;
}

describe('persisted motion compiler state and semantic element ids', () => {
  let directory = '';
  const previous = process.env.CAVALRY_DATA_DIR;
  before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-state-')); process.env.CAVALRY_DATA_DIR = directory; });
  after(() => { fs.rmSync(directory, { recursive: true, force: true }); if (previous === undefined) delete process.env.CAVALRY_DATA_DIR; else process.env.CAVALRY_DATA_DIR = previous; });

  it('indexes generated layers under semantic ids with their UUIDs', () => {
    const runtime = compiledRuntime();
    const state = serializeRuntime(runtime);
    assert.deepEqual(state.layers.map((layer) => layer.semanticId).sort(), ['scene-24.__background', 'scene-24.accent', 'scene-24.hero_word', 'scene-25.__background', 'scene-25.hero_word']);
    assert.equal(state.layers.find((layer) => layer.semanticId === semanticId('scene-24', 'hero_word'))?.uuid, UUID(1));
    assert.equal(state.revision, 7);
    assert.equal(Object.keys(state.sceneHashes).length, 2);
  });

  it('round-trips through the data directory and a scene sidecar', async () => {
    const runtime = compiledRuntime();
    const scenePath = path.join(directory, 'film.cv');
    const [statePath, sidecar] = await persistRuntime(runtime, [scenePath]);
    assert.equal(sidecar, sceneSidecarPath(scenePath));
    for (const file of [statePath, sidecar]) {
      const restored = hydrateRuntime((await readPersistedState(file))!);
      assert.equal(restored.plan.hash, runtime.plan.hash);
      assert.equal(restored.compId, 'compNode#1');
      assert.equal(restored.revision, 7);
      assert.deepEqual(restored.layers.get('scene-24')?.get('hero_word'), runtime.layers.get('scene-24')?.get('hero_word'));
      assert.equal(restored.dirtyScenes.size, 0);
    }
  });

  it('refuses persisted state whose manifest no longer compiles to the same hash', () => {
    const state = serializeRuntime(compiledRuntime());
    state.manifestHash = 'f'.repeat(64);
    assert.throws(() => hydrateRuntime(state), /does not match/);
  });

  it('re-resolves elements after reopen by UUID even when Cavalry reassigns layer ids', () => {
    const runtime = compiledRuntime();
    const live = [
      { layerId: 'textShape#40', uuid: UUID(1), name: 'renamed by user' },
      { layerId: 'basicShape#41', uuid: UUID(2) },
      { layerId: 'basicShape#42', uuid: UUID(3) },
      { layerId: 'textShape#43', uuid: UUID(4) },
      // scene-25 background deleted by the user
    ];
    const check = resolveAgainstLiveScene(runtime, live);
    assert.equal(check.resolved, 4);
    assert.deepEqual(check.missing, ['scene-25.__background']);
    assert.deepEqual(check.missingScenes, ['scene-25']);
    assert.equal(check.layers.get('scene-24')?.get('hero_word')?.layerId, 'textShape#40');
    assert.equal(check.resolvedBy.uuid, 4);
  });

  it('does not match a reused layer id that now belongs to a different UUID', () => {
    const runtime = compiledRuntime();
    const check = resolveAgainstLiveScene(runtime, [{ layerId: 'textShape#1', uuid: UUID(99), name: 'something else' }]);
    assert.ok(check.missing.includes('scene-24.hero_word'));
  });

  it('rebuilds an index from deterministic compiler names when no state was persisted', () => {
    const runtime = compiledRuntime();
    seedIndexFromNames(runtime);
    const check = resolveAgainstLiveScene(runtime, [
      { layerId: 'textShape#1', uuid: UUID(1), name: 'scene-24/hero_word' },
      { layerId: 'basicShape#2', uuid: UUID(2), name: 'scene-24/accent' },
      { layerId: 'basicShape#3', uuid: UUID(3), name: 'Hero Background' },
      { layerId: 'textShape#4', uuid: UUID(4), name: 'scene-25/hero_word' },
      { layerId: 'basicShape#5', uuid: UUID(5), name: 'scene-25 Background' },
      { layerId: 'basicShape#6', uuid: UUID(6), name: 'scene-25 Background' },
    ]);
    assert.equal(check.resolvedBy.name, 4);
    assert.deepEqual(check.missing, ['scene-25.__background'], 'ambiguous names are never guessed');
  });
});

describe('correction planning', () => {
  it('leaves the manifest untouched on a dry run and reports only the affected frame ranges', async () => {
    const { createProject, applyCorrections, projectSpec } = await import('../../src/motion/service.js');
    const spec = { ...project(), id: 'dry-run-corrections' };
    await createProject(spec);
    const before = JSON.stringify(projectSpec(spec.id));
    const planned = await applyCorrections(spec.id, [{ sceneId: 'scene-25', elementId: 'hero_word', issue: 'tight', desiredCorrection: 'open tracking', properties: { tracking: 4 } }], true) as any;
    assert.equal(JSON.stringify(projectSpec(spec.id)), before, 'dry run must not alter the manifest');
    assert.deepEqual(planned.affectedRanges, [{ sceneId: 'scene-25', startFrame: 60, endFrame: 89 }]);
    assert.deepEqual(planned.targets, [{ semanticId: 'scene-25.hero_word', mode: 'rebuild' }]);
  });
});
