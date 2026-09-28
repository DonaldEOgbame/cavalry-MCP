import { CompiledProjectPlan, MotionProjectSpec } from './types.js';

export interface MotionProjectRuntime {
  spec: MotionProjectSpec;
  plan: CompiledProjectPlan;
  compiledHash?: string;
  compiledSceneHashes: Map<string, string>;
  sceneLayerIds: Map<string, string[]>;
  pendingLayerDeletes: Set<string>;
  dirtyScenes: Set<string>;
  compId?: string;
  revision: number;
}

const projects = new Map<string, MotionProjectRuntime>();

export function createRuntime(spec: MotionProjectSpec, plan: CompiledProjectPlan): MotionProjectRuntime {
  const runtime: MotionProjectRuntime = {
    spec,
    plan,
    compiledSceneHashes: new Map(),
    sceneLayerIds: new Map(),
    pendingLayerDeletes: new Set(),
    dirtyScenes: new Set(spec.scenes.map((scene) => scene.id)),
    revision: 0,
  };
  projects.set(spec.id, runtime);
  return runtime;
}

export function runtimeFor(projectId: string): MotionProjectRuntime {
  const runtime = projects.get(projectId);
  if (!runtime) throw new Error(`Unknown motion project '${projectId}'. Call motion_project_create first.`);
  return runtime;
}

export function updateRuntime(runtime: MotionProjectRuntime, spec: MotionProjectSpec, plan: CompiledProjectPlan): void {
  const oldScenes = new Map(runtime.plan.scenes.map((scene) => [scene.sceneId, scene]));
  const nextIds = new Set(plan.scenes.map((scene) => scene.sceneId));
  for (const oldScene of runtime.plan.scenes) {
    if (nextIds.has(oldScene.sceneId)) continue;
    for (const layerId of runtime.sceneLayerIds.get(oldScene.sceneId) ?? []) runtime.pendingLayerDeletes.add(layerId);
    runtime.sceneLayerIds.delete(oldScene.sceneId);
    runtime.compiledSceneHashes.delete(oldScene.sceneId);
    runtime.dirtyScenes.delete(oldScene.sceneId);
  }
  runtime.spec = spec;
  runtime.plan = plan;
  for (const scene of plan.scenes) {
    const oldScene = oldScenes.get(scene.sceneId);
    if (!oldScene || oldScene.hash !== scene.hash || oldScene.startFrame !== scene.startFrame || oldScene.endFrame !== scene.endFrame) {
      runtime.dirtyScenes.add(scene.sceneId);
    }
  }
  runtime.revision += 1;
}
