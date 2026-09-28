import { compileMotionProject } from '../../../src/motion/compiler.js';
import { optimizeTimelineOperations } from '../../../src/motion/service.js';
import type { MotionProjectSpec } from '../../../src/motion/types.js';
import { productionProject } from '../../../scripts/fixtures/production-project.js';
import type { BridgeSandbox } from './bridge-sandbox.js';

export interface WorkloadResult {
  batches: number;
  bridgeOperations: number;
  layersCreated: number;
  keyframesCreated: number;
  correctionTarget: string;
}

/**
 * Replays, through the bridge protocol, exactly what motion_project_compile,
 * motion_project_verify and motion_project_apply_corrections send for the
 * 55-scene production benchmark.
 */
export function runProductionWorkload(sandbox: BridgeSandbox, options: { subscribeEvents?: boolean } = {}): WorkloadResult {
  const spec = productionProject as unknown as MotionProjectSpec;
  const plan = compileMotionProject(spec);
  const expectOk = (response: any, label: string) => {
    if (!response?.ok) throw new Error(`${label} failed: ${JSON.stringify(response?.error ?? response)}`);
    return response.result;
  };
  if (options.subscribeEvents) expectOk(sandbox.send('events_subscribe', { events: ['*'] }), 'events_subscribe');
  expectOk(sandbox.send('scene_new', {}), 'scene_new');
  expectOk(sandbox.send('composition_create', { name: spec.name, width: 1920, height: 1080, fps: 30, startFrame: 0, endFrame: plan.durationFrames - 1, makeActive: true }), 'composition_create');
  let batches = 0;
  let bridgeOperations = 0;
  let layersCreated = 0;
  let correctionTarget = '';
  for (let offset = 0; offset < plan.scenes.length; offset += 5) {
    const group = plan.scenes.slice(offset, offset + 5);
    const operations = optimizeTimelineOperations(group.flatMap((scene) => scene.operations), group.map((scene) => scene.sceneId).join('__'));
    const result = expectOk(sandbox.send('batch', { operations, batchId: `workload:${offset}`, transactional: false, verify: true, stopOnError: true, operationTimeoutMs: 120_000 }), `batch ${offset}`);
    if (!result.allOk) throw new Error(`batch ${offset} failed: ${JSON.stringify(result.stepResults.find((step: any) => !step.ok))}`);
    batches += 1;
    bridgeOperations += operations.length;
    for (const step of result.stepResults) {
      if (step.op === 'layer_create' || step.op === 'layer_create_primitive') layersCreated += 1;
      if (step.id === 'scene-27-headline-create') correctionTarget = step.result.uuid || step.result.layerId;
    }
  }
  // motion_project_verify
  expectOk(sandbox.send('scene_inspect', { detailed: false }), 'scene_inspect');
  // motion_project_apply_corrections (direct attribute correction by stable handle)
  const correction = expectOk(sandbox.send('batch', { operations: [{ id: 'correction-0', op: 'attribute_set_many', params: { layerId: correctionTarget, attributes: { letterSpacing: 4 } } }], transactional: true, verify: true, operationTimeoutMs: 120_000, batchId: 'workload:corrections' }), 'corrections');
  if (!correction.allOk) throw new Error('correction batch failed');
  expectOk(sandbox.send('scene_inspect', { detailed: false }), 'scene_inspect after correction');
  if (options.subscribeEvents) sandbox.send('events_poll', { limit: 1000 });
  return { batches, bridgeOperations, layersCreated, keyframesCreated: plan.expectedKeyframes, correctionTarget };
}
