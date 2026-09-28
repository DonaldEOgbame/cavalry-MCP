import { CompiledProjectPlan, MotionProjectSpec } from './types.js';

/** Element id reserved for the per-scene background layer the compiler creates. */
export const BACKGROUND_ELEMENT_ID = '__background';

/**
 * A generated layer, addressed semantically as `sceneId.elementId`. The UUID
 * survives save/reopen in Cavalry, so it is the preferred handle; the layer id
 * is kept for diagnostics and as a fallback.
 */
export interface LayerRef {
  layerId: string;
  uuid?: string;
  name?: string;
}

export interface RenderRecord {
  jobId: string;
  output: string;
  startFrame: number;
  endFrame: number;
  manifestHash: string;
  completedAt: string;
  recovered: boolean;
  attempts: number;
  sceneIds: string[];
}

export interface MotionProjectRuntime {
  spec: MotionProjectSpec;
  plan: CompiledProjectPlan;
  compiledHash?: string;
  compiledSceneHashes: Map<string, string>;
  /** sceneId → elementId → generated layer. */
  layers: Map<string, Map<string, LayerRef>>;
  pendingLayerDeletes: Set<string>;
  dirtyScenes: Set<string>;
  compId?: string;
  revision: number;
  renders: RenderRecord[];
  scenePath?: string;
}

const projects = new Map<string, MotionProjectRuntime>();

export function semanticId(sceneId: string, elementId: string): string {
  return `${sceneId}.${elementId}`;
}

/** Stable handle the bridge resolves: UUID first, layer id otherwise. */
export function layerHandle(ref: LayerRef): string {
  return ref.uuid || ref.layerId;
}

export function elementLayer(runtime: MotionProjectRuntime, sceneId: string, elementId: string): LayerRef | undefined {
  return runtime.layers.get(sceneId)?.get(elementId);
}

export function sceneLayerHandles(runtime: MotionProjectRuntime, sceneId: string): string[] {
  return [...(runtime.layers.get(sceneId)?.values() ?? [])].map(layerHandle);
}

export function createRuntime(spec: MotionProjectSpec, plan: CompiledProjectPlan): MotionProjectRuntime {
  const runtime: MotionProjectRuntime = {
    spec,
    plan,
    compiledSceneHashes: new Map(),
    layers: new Map(),
    pendingLayerDeletes: new Set(),
    dirtyScenes: new Set(spec.scenes.map((scene) => scene.id)),
    revision: 0,
    renders: [],
  };
  projects.set(spec.id, runtime);
  return runtime;
}

export function registerRuntime(runtime: MotionProjectRuntime): void {
  projects.set(runtime.spec.id, runtime);
}

export function hasRuntime(projectId: string): boolean {
  return projects.has(projectId);
}

export function allRuntimes(): MotionProjectRuntime[] {
  return [...projects.values()];
}

export function runtimeFor(projectId: string): MotionProjectRuntime {
  const runtime = projects.get(projectId);
  if (!runtime) throw new Error(`Unknown motion project '${projectId}'. Call motion_project_create, or motion_project_attach_current to restore persisted state after a restart.`);
  return runtime;
}

export function updateRuntime(runtime: MotionProjectRuntime, spec: MotionProjectSpec, plan: CompiledProjectPlan): void {
  const oldScenes = new Map(runtime.plan.scenes.map((scene) => [scene.sceneId, scene]));
  const nextIds = new Set(plan.scenes.map((scene) => scene.sceneId));
  for (const oldScene of runtime.plan.scenes) {
    if (nextIds.has(oldScene.sceneId)) continue;
    for (const handle of sceneLayerHandles(runtime, oldScene.sceneId)) runtime.pendingLayerDeletes.add(handle);
    runtime.layers.delete(oldScene.sceneId);
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
