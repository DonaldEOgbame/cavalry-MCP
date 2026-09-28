import fs from 'node:fs/promises';
import path from 'node:path';
import { userDataDirectory } from '../utils/paths.js';
import { compileMotionProject } from './compiler.js';
import { LayerRef, MotionProjectRuntime, RenderRecord, semanticId } from './store.js';
import { MotionProjectSpec } from './types.js';

/**
 * Compiler state survives MCP restarts, Cavalry restarts, and reopen cycles:
 * it is written to the data directory after every mutation and next to scene
 * files (`<scene>.cv.motion.json`) when scenes are saved or checkpointed.
 */
export const MOTION_STATE_SCHEMA_VERSION = 1;

export interface PersistedLayer extends LayerRef {
  semanticId: string;
  sceneId: string;
  elementId: string;
}

export interface PersistedMotionState {
  schemaVersion: typeof MOTION_STATE_SCHEMA_VERSION;
  projectId: string;
  revision: number;
  manifestHash: string;
  compiledHash: string | null;
  compId: string | null;
  scenePath: string | null;
  spec: MotionProjectSpec;
  sceneHashes: Record<string, string>;
  compiledSceneHashes: Record<string, string>;
  dirtyScenes: string[];
  pendingLayerDeletes: string[];
  layers: PersistedLayer[];
  renders: RenderRecord[];
  updatedAt: string;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function projectStatePath(projectId: string): string {
  return path.join(userDataDirectory(), 'projects', safeName(projectId), 'state.json');
}

export function sceneSidecarPath(scenePath: string): string {
  return `${scenePath}.motion.json`;
}

export function serializeRuntime(runtime: MotionProjectRuntime): PersistedMotionState {
  const layers: PersistedLayer[] = [];
  for (const [sceneId, elements] of runtime.layers) {
    for (const [elementId, ref] of elements) layers.push({ semanticId: semanticId(sceneId, elementId), sceneId, elementId, ...ref });
  }
  return {
    schemaVersion: MOTION_STATE_SCHEMA_VERSION,
    projectId: runtime.spec.id,
    revision: runtime.revision,
    manifestHash: runtime.plan.hash,
    compiledHash: runtime.compiledHash ?? null,
    compId: runtime.compId ?? null,
    scenePath: runtime.scenePath ?? null,
    spec: runtime.spec,
    sceneHashes: Object.fromEntries(runtime.plan.scenes.map((scene) => [scene.sceneId, scene.hash])),
    compiledSceneHashes: Object.fromEntries(runtime.compiledSceneHashes),
    dirtyScenes: [...runtime.dirtyScenes],
    pendingLayerDeletes: [...runtime.pendingLayerDeletes],
    layers,
    renders: runtime.renders.slice(-20),
    updatedAt: new Date().toISOString(),
  };
}

export function hydrateRuntime(state: PersistedMotionState): MotionProjectRuntime {
  if (state.schemaVersion !== MOTION_STATE_SCHEMA_VERSION) throw new Error(`Unsupported motion state schema ${state.schemaVersion}; expected ${MOTION_STATE_SCHEMA_VERSION}.`);
  const plan = compileMotionProject(state.spec);
  // A changed compiler would produce different operations for the same
  // manifest; the persisted layer map then no longer describes the scene.
  if (plan.hash !== state.manifestHash) throw new Error(`Persisted manifest hash ${state.manifestHash.slice(0, 12)} does not match the recompiled manifest ${plan.hash.slice(0, 12)}.`);
  const layers = new Map<string, Map<string, LayerRef>>();
  for (const { sceneId, elementId, layerId, uuid, name } of state.layers) {
    if (!layers.has(sceneId)) layers.set(sceneId, new Map());
    layers.get(sceneId)!.set(elementId, { layerId, ...(uuid ? { uuid } : {}), ...(name ? { name } : {}) });
  }
  return {
    spec: state.spec,
    plan,
    compiledHash: state.compiledHash ?? undefined,
    compiledSceneHashes: new Map(Object.entries(state.compiledSceneHashes)),
    layers,
    pendingLayerDeletes: new Set(state.pendingLayerDeletes),
    dirtyScenes: new Set(state.dirtyScenes),
    compId: state.compId ?? undefined,
    revision: state.revision,
    renders: state.renders ?? [],
    scenePath: state.scenePath ?? undefined,
  };
}

async function writeAtomic(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, file);
}

/** Writes the canonical state, and a sidecar beside each given scene file. */
export async function persistRuntime(runtime: MotionProjectRuntime, scenePaths: string[] = []): Promise<string[]> {
  const state = serializeRuntime(runtime);
  const targets = [projectStatePath(runtime.spec.id), ...scenePaths.map(sceneSidecarPath)];
  await Promise.all(targets.map((target) => writeAtomic(target, state)));
  return targets;
}

export async function readPersistedState(file: string): Promise<PersistedMotionState | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as PersistedMotionState;
  } catch {
    return null;
  }
}

export interface LiveLayer {
  layerId: string;
  uuid?: string;
  name?: string;
}

export interface AttachmentCheck {
  resolved: number;
  missing: string[];
  missingScenes: string[];
  resolvedBy: Record<'uuid' | 'layerId' | 'name', number>;
  layers: Map<string, Map<string, LayerRef>>;
}

/**
 * Re-resolves every semantic element against the live scene inventory: by
 * UUID, then layer id, then the compiler's default `sceneId/elementId` name.
 */
export function resolveAgainstLiveScene(runtime: MotionProjectRuntime, live: LiveLayer[]): AttachmentCheck {
  const byUuid = new Map(live.filter((layer) => layer.uuid).map((layer) => [layer.uuid!, layer]));
  const byId = new Map(live.map((layer) => [layer.layerId, layer]));
  const byName = new Map<string, LiveLayer | null>();
  for (const layer of live) if (layer.name) byName.set(layer.name, byName.has(layer.name) ? null : layer);
  const resolvedBy = { uuid: 0, layerId: 0, name: 0 };
  const missing: string[] = [];
  const missingScenes = new Set<string>();
  const layers = new Map<string, Map<string, LayerRef>>();
  let resolved = 0;
  for (const [sceneId, elements] of runtime.layers) {
    for (const [elementId, ref] of elements) {
      const scene = runtime.spec.scenes.find((item) => item.id === sceneId);
      const element = scene?.elements.find((item) => item.id === elementId);
      const defaultName = elementId === '__background' ? `${scene?.name ?? sceneId} Background` : (element?.name ?? `${sceneId}/${elementId}`);
      let match: LiveLayer | null | undefined;
      let via: keyof typeof resolvedBy | undefined;
      if (ref.uuid && byUuid.has(ref.uuid)) { match = byUuid.get(ref.uuid); via = 'uuid'; }
      else if (byId.has(ref.layerId) && (!ref.uuid || !byId.get(ref.layerId)!.uuid)) { match = byId.get(ref.layerId); via = 'layerId'; }
      else if (byName.get(defaultName)) { match = byName.get(defaultName); via = 'name'; }
      if (!match || !via) {
        missing.push(semanticId(sceneId, elementId));
        missingScenes.add(sceneId);
        continue;
      }
      resolved += 1;
      resolvedBy[via] += 1;
      if (!layers.has(sceneId)) layers.set(sceneId, new Map());
      layers.get(sceneId)!.set(elementId, { layerId: match.layerId, ...(match.uuid ? { uuid: match.uuid } : {}), ...(match.name ? { name: match.name } : {}) });
    }
  }
  return { resolved, missing, missingScenes: [...missingScenes], resolvedBy, layers };
}

/**
 * Seeds an element index from the compiler's deterministic layer names, for
 * scenes compiled before an index was persisted. Resolution still verifies
 * each name is unique in the live scene.
 */
export function seedIndexFromNames(runtime: MotionProjectRuntime): void {
  runtime.layers = new Map(runtime.spec.scenes.map((scene) => [
    scene.id,
    new Map<string, LayerRef>([
      ...scene.elements.map((element) => [element.id, { layerId: '' }] as [string, LayerRef]),
      ['__background', { layerId: '' }],
    ]),
  ]));
}
