import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileMotionProject, motionHash } from '../../src/motion/compiler.js';
import { motionProjectSchema } from '../../src/motion/schemas.js';
import { MotionPrimitive, MotionProjectSpec } from '../../src/motion/types.js';
import { createRuntime, updateRuntime } from '../../src/motion/store.js';

const primitives: MotionPrimitive[] = [
  'enterUp', 'enterDown', 'enterLeft', 'enterRight', 'wordSwap', 'verticalRoll',
  'progressiveBuild', 'textReflow', 'pushTransition', 'scaleTakeover', 'scaleTransfer',
  'zoomThrough', 'maskedReveal', 'trackingExpansion', 'colorSnap', 'hardCut',
];

function benchmarkProject(): MotionProjectSpec {
  return {
    id: 'production-benchmark',
    name: 'Production Benchmark',
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    designTokens: { colors: { light: '#f5f1e8', dark: '#111827', red: '#ef4444', blue: '#2563eb' } },
    typographyStyles: {
      headline: { fontFamily: 'Helvetica', fontStyle: 'Bold', fontSize: 112, color: '#ffffff', alignment: 'center' },
      expressive: { fontFamily: 'Georgia', fontStyle: 'Regular', fontSize: 128, color: '#ffffff', alignment: 'center', tracking: 2 },
    },
    scenes: Array.from({ length: 55 }, (_, index) => ({
      id: `scene-${index + 1}`,
      durationFrames: index === 54 ? 42 : 57,
      background: ['light', 'dark', 'red', 'blue'][index % 4],
      elements: [
        {
          id: 'headline', kind: 'text' as const, text: `Headline ${index + 1}`, style: 'headline', position: { x: 0, y: -35 },
          motions: [
            { type: primitives[index % primitives.length], durationFrames: 16 },
            { type: primitives[(index + 5) % primitives.length], startFrame: 20, durationFrames: 16 },
            { type: primitives[(index + 7) % primitives.length], startFrame: 32, durationFrames: 12 },
            { type: primitives[(index + 11) % primitives.length], startFrame: 42, durationFrames: 10 },
            { type: primitives[(index + 14) % primitives.length], startFrame: 48, durationFrames: 8 },
          ],
        },
        ...(index % 2 === 0 ? [{
          id: 'accent', kind: 'text' as const, text: `Accent ${index + 1}`, style: 'expressive', position: { x: 0, y: 80 },
          motions: [
            { type: primitives[(index + 2) % primitives.length], durationFrames: 14 },
            { type: primitives[(index + 9) % primitives.length], startFrame: 22, durationFrames: 14 },
            { type: primitives[(index + 4) % primitives.length], startFrame: 34, durationFrames: 10 },
            { type: primitives[(index + 13) % primitives.length], startFrame: 44, durationFrames: 8 },
          ],
        }] : []),
      ],
    })),
  };
}

describe('declarative motion compiler', () => {
  it('validates and deterministically compiles a production-sized project', () => {
    const spec = motionProjectSchema.parse(benchmarkProject()) as MotionProjectSpec;
    const first = compileMotionProject(spec);
    const second = compileMotionProject(spec);
    assert.equal(first.hash, second.hash);
    assert.equal(first.scenes.length, 55);
    assert.equal(first.durationFrames, 3120);
    assert.equal(first.expectedLayers, 138);
    assert.ok(first.expectedKeyframes >= 2000, `expected at least 2,000 keyframes, got ${first.expectedKeyframes}`);
    assert.ok(first.operationCount > first.expectedKeyframes);
    assert.equal(first.scenes[0].operations.some((operation) => operation.op === 'cavalry_raw_script'), false);
    assert.equal(first.scenes.every((scene) => scene.operations.some((operation) => operation.op === 'marker_create')), true);
  });

  it('changes only the affected scene hash for a local declarative edit', () => {
    const spec = benchmarkProject();
    const before = compileMotionProject(spec);
    spec.scenes[20].elements[0].text = 'Corrected headline';
    const after = compileMotionProject(spec);
    assert.notEqual(before.hash, after.hash);
    assert.equal(before.scenes.filter((scene, index) => scene.hash !== after.scenes[index].hash).length, 1);
    assert.notEqual(motionHash(spec.scenes[20]), before.scenes[20].hash);
  });

  it('marks downstream scenes dirty when an earlier duration shifts absolute timing', () => {
    const spec = benchmarkProject();
    const runtime = createRuntime(spec, compileMotionProject(spec));
    runtime.dirtyScenes.clear();
    const updated = structuredClone(spec);
    updated.scenes[0].durationFrames += 3;
    updateRuntime(runtime, updated, compileMotionProject(updated));
    assert.equal(runtime.dirtyScenes.size, 55);
  });

  it('tracks removed scene layers for deletion on the next live compile', () => {
    const spec = benchmarkProject();
    const runtime = createRuntime(spec, compileMotionProject(spec));
    runtime.dirtyScenes.clear();
    runtime.sceneLayerIds.set('scene-2', ['textShape#2', 'basicShape#2']);
    const updated = structuredClone(spec);
    updated.scenes.splice(1, 1);
    updateRuntime(runtime, updated, compileMotionProject(updated));
    assert.deepEqual([...runtime.pendingLayerDeletes].sort(), ['basicShape#2', 'textShape#2']);
    assert.equal(runtime.sceneLayerIds.has('scene-2'), false);
  });

  it('compiles hierarchy even when a child precedes its parent in the manifest', () => {
    const spec = benchmarkProject();
    spec.scenes = [{
      id: 'hierarchy', durationFrames: 30, background: '#000000', elements: [
        { id: 'child', kind: 'text', text: 'Child', parentId: 'parent' },
        { id: 'parent', kind: 'group' },
      ],
    }];
    const plan = compileMotionProject(spec);
    const parenting = plan.scenes[0].operations.find((operation) => operation.op === 'layer_parent');
    assert.deepEqual(parenting?.params, { childLayerId: '$hierarchy_child', parentLayerId: '$hierarchy_parent' });
  });

  it('expands reusable transition definitions at scene boundaries', () => {
    const spec = benchmarkProject();
    spec.transitions = { exit: { id: 'exit', primitive: 'enterRight', durationFrames: 8, amount: 240, easing: 'SlowIn' } };
    spec.scenes = [{
      id: 'transition', durationFrames: 30, background: '#000000', transitionOut: { transitionId: 'exit' },
      elements: [{ id: 'headline', kind: 'text', text: 'Exit' }],
    }];
    const plan = compileMotionProject(spec);
    const exitStart = plan.scenes[0].operations.find((operation) => operation.id.includes('position.x-from'));
    assert.equal(exitStart?.params.frame, 22);
    assert.equal(exitStart?.params.value, 240);
  });

  it('rejects ambiguous normalized IDs and invalid scene references', () => {
    const spec = benchmarkProject();
    spec.scenes = [{
      id: 'bad', durationFrames: 30, background: '#000000',
      elements: [
        { id: 'same id', kind: 'group' },
        { id: 'same@id', kind: 'text', text: 'Bad', parentId: 'missing', style: 'missing-style' },
      ],
    }];
    const parsed = motionProjectSchema.safeParse(spec);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.issues.length >= 3);
  });
});
