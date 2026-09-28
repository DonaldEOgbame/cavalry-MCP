import fs from 'node:fs/promises';
import path from 'node:path';
import { compileMotionProject, estimateLegacyCallCount, motionHash } from './compiler.js';
import { allRuntimes, BACKGROUND_ELEMENT_ID, createRuntime, elementLayer, hasRuntime, layerHandle, LayerRef, MotionProjectRuntime, registerRuntime, runtimeFor, sceneLayerHandles, semanticId, updateRuntime } from './store.js';
import { hydrateRuntime, LiveLayer, persistRuntime, projectStatePath, readPersistedState, resolveAgainstLiveScene, sceneSidecarPath, seedIndexFromNames } from './persistence.js';
import { MotionCorrection, MotionElement, MotionPrimitive, MotionProjectSpec } from './types.js';
import { addTiming, recordBatches, recordCall, resetTelemetry, telemetryFor } from './telemetry.js';
import { executeBatch } from '../cavalry/capabilities.js';
import * as Scene from '../cavalry/scene.js';
import * as Comp from '../cavalry/compositions.js';
import * as Layer from '../cavalry/layers.js';
import * as RenderService from '../render/service.js';
import { CavalryError } from '../mcp/errors.js';
import { filesystem } from '../utils/filesystem.js';
import * as Preview from '../preview/frames.js';
import { bridgeClient } from '../bridge/client.js';
import { logger } from '../utils/logger.js';
import { certificationStatus, primitivesUsed } from './certification.js';

function now(): number { return Date.now(); }

/** Persists compiler state after a mutation; never fails the mutation itself. */
async function persist(runtime: MotionProjectRuntime, scenePaths: string[] = []): Promise<{ statePath: string | null; sidecars: string[] }> {
  try {
    const [statePath, ...sidecars] = await persistRuntime(runtime, scenePaths);
    return { statePath, sidecars };
  } catch (error) {
    logger.warn('Could not persist motion compiler state', { data: error });
    return { statePath: null, sidecars: [] };
  }
}

/** Writes a state sidecar next to a saved scene for every project compiled into it. */
export async function writeSceneSidecars(scenePath: string | undefined): Promise<string[]> {
  if (!scenePath) return [];
  const written: string[] = [];
  for (const runtime of allRuntimes().filter((item) => item.compId)) {
    runtime.scenePath = scenePath;
    written.push(...(await persist(runtime, [scenePath])).sidecars);
  }
  return written;
}

function withCall<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const started = now();
  return operation().finally(() => recordCall(projectId, now() - started));
}

function layerIdsFromBatch(result: any): string[] {
  return (result.stepResults ?? [])
    .filter((step: any) => step.ok && (step.op === 'layer_create' || step.op === 'layer_create_primitive'))
    .map((step: any) => step.result?.layerId)
    .filter((value: unknown): value is string => typeof value === 'string');
}

export function optimizeTimelineOperations(operations: any[], sceneId: string): any[] {
  const keyframes: any[] = [];
  const easings: any[] = [];
  const interpolations: any[] = [];
  const retained: any[] = [];
  for (const operation of operations) {
    if (operation.op === 'keyframe_create') keyframes.push(operation.params);
    else if (operation.op === 'keyframe_magic_easing') easings.push(operation.params);
    else if (operation.op === 'keyframe_set_interpolation') interpolations.push(operation.params);
    else retained.push(operation);
  }
  if (keyframes.length || easings.length || interpolations.length) retained.push({
    id: `${sceneId}-timeline-bulk`,
    op: 'timeline_compile_bulk',
    params: { keyframes, easings, interpolations },
  });
  return retained;
}

/** Indexes created layers by semantic element id (`sceneId.elementId`). */
export function indexSceneLayers(runtime: MotionProjectRuntime, sceneId: string, result: any): void {
  const scene = runtime.spec.scenes.find((item) => item.id === sceneId);
  const sceneKey = sceneId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const elementByCreateId = new Map<string, string>([
    [`${sceneKey}-background-create`, BACKGROUND_ELEMENT_ID],
    ...(scene?.elements ?? []).map((element) => [`${sceneKey}-${element.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-create`, element.id] as [string, string]),
  ]);
  const layers = new Map<string, LayerRef>();
  for (const step of result.stepResults ?? []) {
    if (!step.ok || (step.op !== 'layer_create' && step.op !== 'layer_create_primitive')) continue;
    const elementId = typeof step.id === 'string' ? elementByCreateId.get(step.id) : undefined;
    const layerId = step.result?.layerId;
    if (!elementId || typeof layerId !== 'string') continue;
    layers.set(elementId, { layerId, ...(step.result?.uuid ? { uuid: String(step.result.uuid) } : {}), ...(step.result?.name ? { name: String(step.result.name) } : {}) });
  }
  runtime.layers.set(sceneId, layers);
}

function primitiveForText(text: string, index: number): MotionPrimitive {
  const value = text.toLowerCase();
  if (/roll|vertical/.test(value)) return 'verticalRoll';
  if (/swap|replace|word/.test(value)) return 'wordSwap';
  if (/mask|reveal/.test(value)) return 'maskedReveal';
  if (/zoom/.test(value)) return 'zoomThrough';
  if (/scale transfer/.test(value)) return 'scaleTransfer';
  if (/scale|takeover/.test(value)) return 'scaleTakeover';
  if (/reflow|wrap/.test(value)) return 'textReflow';
  if (/push/.test(value)) return 'pushTransition';
  if (/track|expand/.test(value)) return 'trackingExpansion';
  if (/color|colour|background|snap/.test(value)) return 'colorSnap';
  const defaults: MotionPrimitive[] = ['enterUp', 'enterLeft', 'progressiveBuild', 'enterRight'];
  return defaults[index % defaults.length];
}

export async function planBrief(input: {
  id: string;
  name: string;
  brief: string;
  resolution?: { width: number; height: number };
  fps?: number;
  durationSeconds?: number;
  primaryFont?: string;
  expressiveFont?: string;
  colors?: string[];
}): Promise<Record<string, unknown>> {
  resetTelemetry(input.id);
  return withCall(input.id, async () => {
    const started = now();
    const fps = input.fps ?? 30;
    const totalFrames = Math.round((input.durationSeconds ?? 105) * fps);
    let beats = input.brief.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim()).filter((line) => line.length > 2);
    if (beats.length < 2) beats = input.brief.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
    const targetCount = Math.min(60, Math.max(1, beats.length));
    beats = beats.slice(0, targetCount);
    const baseDuration = Math.floor(totalFrames / beats.length);
    const palette = input.colors?.length ? input.colors : ['#f6f2e8', '#18181b', '#ef4444', '#2563eb'];
    const scenes = beats.map((text, index) => ({
      id: `scene-${String(index + 1).padStart(2, '0')}`,
      name: `Beat ${index + 1}`,
      durationFrames: index === beats.length - 1 ? totalFrames - baseDuration * index : baseDuration,
      background: `background${index % palette.length}`,
      elements: [{
        id: 'headline', kind: 'text' as const, text, style: index % 5 === 4 ? 'expressive' : 'headline',
        position: { x: 0, y: 0 }, motions: [{ type: primitiveForText(text, index), durationFrames: Math.min(20, Math.floor(baseDuration / 3)) }],
      }],
    }));
    const colors = Object.fromEntries(palette.map((value, index) => [`background${index}`, value]));
    const project: MotionProjectSpec = {
      id: input.id,
      name: input.name,
      resolution: input.resolution ?? { width: 1920, height: 1080 },
      fps,
      designTokens: { colors },
      typographyStyles: {
        headline: { fontFamily: input.primaryFont ?? 'Helvetica', fontStyle: 'Bold', fontSize: 112, color: '#ffffff', alignment: 'center', tracking: 0 },
        expressive: { fontFamily: input.expressiveFont ?? input.primaryFont ?? 'Helvetica', fontStyle: 'Regular', fontSize: 128, color: '#ffffff', alignment: 'center', tracking: 2 },
      },
      globalTiming: { defaultTransitionFrames: 18, sceneGapFrames: 0 },
      scenes,
    };
    addTiming(input.id, 'planningMs', now() - started);
    return { project, sceneCount: scenes.length, durationFrames: totalFrames, warning: beats.length < 50 ? 'The brief produced fewer than 50 explicit beats; supply one line per intended beat for a 50–60 scene plan.' : undefined };
  });
}

export async function createProject(spec: MotionProjectSpec): Promise<Record<string, unknown>> {
  return withCall(spec.id, async () => {
    const started = now();
    const plan = compileMotionProject(spec);
    const runtime = createRuntime(spec, plan);
    addTiming(spec.id, 'compilationMs', now() - started);
    return {
      primitiveCertification: certificationStatus(primitivesUsed(spec)),
      projectId: spec.id,
      revision: runtime.revision,
      manifestHash: plan.hash,
      sceneCount: plan.scenes.length,
      durationFrames: plan.durationFrames,
      expectedLayers: plan.expectedLayers,
      expectedKeyframes: plan.expectedKeyframes,
      compiledOperationCount: plan.operationCount,
      estimatedLegacyMcpCalls: estimateLegacyCallCount(plan),
      estimatedCompilerMcpCalls: 5,
      estimatedCallReductionPercent: Number(((1 - 5 / Math.max(5, estimateLegacyCallCount(plan))) * 100).toFixed(2)),
    };
  });
}

async function executeScenes(projectId: string, sceneIds: string[], dryRun: boolean): Promise<Record<string, unknown>> {
  const runtime = runtimeFor(projectId);
  const scenes = runtime.plan.scenes.filter((scene) => sceneIds.includes(scene.sceneId));
  if (dryRun) return {
    dryRun: true,
    pendingLayerDeletes: runtime.pendingLayerDeletes.size,
    scenes: scenes.map((scene) => ({ sceneId: scene.sceneId, operations: scene.operations.length, expectedLayers: scene.expectedLayers, expectedKeyframes: scene.expectedKeyframes, hash: scene.hash })),
    operationCount: scenes.reduce((sum, scene) => sum + scene.operations.length, 0),
  };
  const started = now();
  const batchSizes: number[] = [];
  const results: Array<Record<string, unknown>> = [];
  const groups: Array<Record<string, unknown>> = [];
  if (runtime.pendingLayerDeletes.size) {
    await Layer.layerDelete([...runtime.pendingLayerDeletes]);
    runtime.pendingLayerDeletes.clear();
  }
  const sceneBatchSize = 5;
  for (let offset = 0; offset < scenes.length; offset += sceneBatchSize) {
    const sceneGroup = scenes.slice(offset, offset + sceneBatchSize);
    const existing = sceneGroup.flatMap((scene) => sceneLayerHandles(runtime, scene.sceneId));
    if (existing.length) await Layer.layerDelete(existing);
    const revision = await bridgeClient.send<any>('events_status').then((response) => response.result?.sceneRevision).catch(() => undefined);
    const logicalOperations = sceneGroup.flatMap((scene) => scene.operations);
    const groupId = sceneGroup.map((scene) => scene.sceneId).join('__');
    const optimizedOperations = optimizeTimelineOperations(logicalOperations, groupId);
    const batchParams = {
      operations: optimizedOperations,
      batchId: `${projectId}:r${runtime.revision}:${groupId}`,
      transactional: false,
      verify: true,
      stopOnError: true,
      operationTimeoutMs: 120_000,
    } as const;
    let result;
    try {
      result = await executeBatch({ ...batchParams, ...(typeof revision === 'number' ? { expectedRevision: revision } : {}) });
    } catch (error: any) {
      // Native callbacks from the preceding compiler batch can advance the
      // revision after events_status but before the next request is handled.
      // The rejected batch has not mutated the scene, so refresh/retry once.
      if (error?.code !== 'EDIT_CONFLICT' && error?.details?.code !== 'EDIT_CONFLICT') throw error;
      result = await executeBatch(batchParams);
    }
    if (!result.allOk) {
      const failed = result.stepResults.find((step) => !step.ok);
      throw new Error(`Scene group '${groupId}' compilation failed at ${failed?.id ?? 'unknown'}/${failed?.op ?? 'unknown'}: ${JSON.stringify(failed?.error ?? {})}`);
    }
    if (result.stepResults.some((step: any) => step.result?.synthetic || step.result?.skipped)) throw new Error(`Scene group '${groupId}' produced a synthetic or skipped batch result.`);
    for (const scene of sceneGroup) {
      indexSceneLayers(runtime, scene.sceneId, result);
      runtime.compiledSceneHashes.set(scene.sceneId, scene.hash);
      runtime.dirtyScenes.delete(scene.sceneId);
      results.push({
        sceneId: scene.sceneId,
        logicalOperations: scene.operations.length,
        batchId: batchParams.batchId,
        elements: Object.fromEntries([...(runtime.layers.get(scene.sceneId) ?? new Map())].map(([elementId, ref]) => [semanticId(scene.sceneId, elementId), ref.layerId])),
      });
    }
    batchSizes.push(optimizedOperations.length);
    groups.push({ sceneIds: sceneGroup.map((scene) => scene.sceneId), logicalOperations: logicalOperations.length, bridgeOperations: optimizedOperations.length, durationMs: result.durationMs, layerIds: layerIdsFromBatch(result) });
  }
  recordBatches(projectId, batchSizes, now() - started);
  runtime.compiledHash = runtime.dirtyScenes.size ? undefined : runtime.plan.hash;
  const persisted = await persist(runtime);
  return { dryRun: false, scenes: results, groups, batchCount: batchSizes.length, operationCount: batchSizes.reduce((sum, size) => sum + size, 0), dirtyScenes: [...runtime.dirtyScenes], statePath: persisted.statePath };
}

export async function compileProject(projectId: string, force = false, dryRun = false): Promise<Record<string, unknown>> {
  return withCall(projectId, async () => {
    const runtime = runtimeFor(projectId);
    if (dryRun) return executeScenes(projectId, runtime.plan.scenes.map((scene) => scene.sceneId), true);
    if (force || !runtime.compId) {
      await Scene.sceneNew(true);
      const composition = await Comp.compositionCreate({
        name: runtime.spec.name,
        width: runtime.spec.resolution.width,
        height: runtime.spec.resolution.height,
        fps: runtime.spec.fps,
        startFrame: 0,
        endFrame: runtime.plan.durationFrames - 1,
        makeActive: true,
      });
      runtime.compId = String((composition as any).compId ?? (composition as any).layerId);
      runtime.layers.clear();
      runtime.pendingLayerDeletes.clear();
      runtime.compiledSceneHashes.clear();
      runtime.dirtyScenes = new Set(runtime.spec.scenes.map((scene) => scene.id));
    }
    const targets = force ? runtime.plan.scenes.map((scene) => scene.sceneId) : [...runtime.dirtyScenes];
    const result = await executeScenes(projectId, targets, false);
    return { projectId, compId: runtime.compId, manifestHash: runtime.plan.hash, ...result };
  });
}

export async function buildScenes(projectId: string, sceneIds: string[], dryRun = false): Promise<Record<string, unknown>> {
  return withCall(projectId, () => executeScenes(projectId, sceneIds, dryRun));
}

export async function updateProject(projectId: string, spec: MotionProjectSpec, compile = true, dryRun = false): Promise<Record<string, unknown>> {
  return withCall(projectId, async () => {
    if (spec.id !== projectId) throw new Error('Project id cannot change during update.');
    const runtime = runtimeFor(projectId);
    const started = now();
    const plan = compileMotionProject(spec);
    updateRuntime(runtime, spec, plan);
    addTiming(projectId, 'compilationMs', now() - started);
    const result = compile ? await executeScenes(projectId, [...runtime.dirtyScenes], dryRun) : { dirtyScenes: [...runtime.dirtyScenes] };
    if (!compile && !dryRun) await persist(runtime);
    return { projectId, revision: runtime.revision, manifestHash: plan.hash, ...result };
  });
}

export async function retimeSequence(projectId: string, durations: Record<string, number>, compile = true, dryRun = false): Promise<Record<string, unknown>> {
  const runtime = runtimeFor(projectId);
  const spec = structuredClone(runtime.spec);
  let changed = false;
  for (const scene of spec.scenes) {
    if (durations[scene.id] !== undefined && durations[scene.id] !== scene.durationFrames) {
      scene.durationFrames = durations[scene.id];
      changed = true;
    }
  }
  if (!changed) return { projectId, changed: false, dirtyScenes: [] };
  // Only the retimed scenes and those whose absolute frames moved are dirty;
  // updateRuntime compares each scene's hash and start/end frames.
  const result = await updateProject(projectId, spec, false, dryRun);
  return compile ? compileProject(projectId, false, dryRun) : result;
}

function attributesForCorrection(element: MotionElement, properties: MotionCorrection['properties']): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  if (!properties) return attributes;
  if (properties.text !== undefined) attributes.text = { text: properties.text, overrides: [] };
  if (properties.position !== undefined) attributes.position = properties.position;
  if (properties.scale !== undefined) attributes.scale = typeof properties.scale === 'number' ? { x: properties.scale, y: properties.scale } : properties.scale;
  if (properties.opacity !== undefined) attributes.opacity = properties.opacity;
  if (properties.rotation !== undefined) attributes.rotation = properties.rotation;
  if (properties.color !== undefined) attributes['material.materialColor'] = properties.color;
  if (properties.tracking !== undefined) attributes.letterSpacing = properties.tracking;
  if (properties.lineHeight !== undefined) attributes.lineSpacing = properties.lineHeight;
  if (properties.width !== undefined || properties.height !== undefined) attributes['generator.dimensions'] = { x: properties.width ?? element.width ?? 100, y: properties.height ?? element.height ?? 100 };
  return attributes;
}

export async function applyCorrections(projectId: string, corrections: MotionCorrection[], dryRun = false): Promise<Record<string, unknown>> {
  return withCall(projectId, async () => {
    const started = now();
    const runtime = runtimeFor(projectId);
    const operations: any[] = [];
    const rebuild = new Set<string>();
    const directScenes = new Set<string>();
    const targets: Array<{ semanticId: string; mode: 'direct' | 'rebuild'; handle?: string }> = [];
    // Corrections are staged on a copy so a dry run never alters the manifest.
    const spec = dryRun ? structuredClone(runtime.spec) : runtime.spec;
    for (const correction of corrections) {
      const scene = spec.scenes.find((item) => item.id === correction.sceneId);
      const element = scene?.elements.find((item) => item.id === correction.elementId);
      if (!scene || !element) throw new Error(`Unknown correction target ${semanticId(correction.sceneId, correction.elementId)}.`);
      if (correction.properties) Object.assign(element, correction.properties);
      if (correction.timing) {
        for (const motion of element.motions ?? []) {
          motion.startFrame = Math.max(0, (motion.startFrame ?? 0) + (correction.timing.shiftFrames ?? 0));
          if (correction.timing.durationScale) motion.durationFrames = Math.max(1, Math.round((motion.durationFrames ?? 18) * correction.timing.durationScale));
        }
        rebuild.add(scene.id);
      }
      if (correction.hierarchy) {
        element.parentId = correction.hierarchy.parentId ?? undefined;
        rebuild.add(scene.id);
      }
      // The UUID handle survives save/reopen and recovery restarts.
      const ref = elementLayer(runtime, scene.id, element.id);
      const attributes = attributesForCorrection(element, correction.properties);
      if (ref && Object.keys(attributes).length) {
        operations.push({ id: `correction-${operations.length}`, op: 'attribute_set_many', params: { layerId: layerHandle(ref), attributes } });
        directScenes.add(scene.id);
        targets.push({ semanticId: semanticId(scene.id, element.id), mode: 'direct', handle: layerHandle(ref) });
      }
      else if (Object.keys(attributes).length) rebuild.add(scene.id);
      const directPropertyNames = new Set(['text', 'position', 'scale', 'opacity', 'rotation', 'color', 'tracking', 'lineHeight', 'width', 'height']);
      if (correction.properties && Object.keys(correction.properties).some((key) => !directPropertyNames.has(key))) rebuild.add(scene.id);
      if (rebuild.has(scene.id) && !targets.some((target) => target.semanticId === semanticId(scene.id, element.id))) targets.push({ semanticId: semanticId(scene.id, element.id), mode: 'rebuild' });
    }
    const plan = compileMotionProject(spec);
    // Frames that must be re-reviewed or re-rendered after this correction.
    const affectedScenes = new Set([...directScenes, ...rebuild]);
    const affectedRanges = plan.scenes.filter((scene) => affectedScenes.has(scene.sceneId)).map((scene) => ({ sceneId: scene.sceneId, startFrame: scene.startFrame, endFrame: scene.endFrame }));
    if (dryRun) return { dryRun: true, directOperations: operations.length, rebuildScenes: [...rebuild], targets, affectedRanges, manifestHash: plan.hash };
    updateRuntime(runtime, runtime.spec, plan);
    let directResult: any = null;
    if (operations.length) {
      const batchStarted = now();
      directResult = await executeBatch({ operations, transactional: true, verify: true, operationTimeoutMs: 120_000, batchId: `${projectId}:r${runtime.revision}:corrections` } as any);
      if (!directResult.allOk) throw new Error('Correction batch failed.');
      recordBatches(projectId, [operations.length], now() - batchStarted);
    }
    for (const sceneId of directScenes) {
      if (rebuild.has(sceneId)) continue;
      const compiledScene = plan.scenes.find((scene) => scene.sceneId === sceneId);
      if (compiledScene) runtime.compiledSceneHashes.set(sceneId, compiledScene.hash);
      runtime.dirtyScenes.delete(sceneId);
    }
    for (const sceneId of rebuild) runtime.dirtyScenes.add(sceneId);
    const rebuilt = rebuild.size ? await executeScenes(projectId, [...rebuild], false) : null;
    if (!runtime.dirtyScenes.size) runtime.compiledHash = runtime.plan.hash;
    const persisted = await persist(runtime);
    addTiming(projectId, 'correctionMs', now() - started);
    return { applied: corrections.length, directOperations: operations.length, targets, affectedRanges, untouchedScenes: plan.scenes.length - affectedScenes.size, rebuilt, manifestHash: plan.hash, revision: runtime.revision, statePath: persisted.statePath };
  });
}

export async function verifyProject(projectId: string, detailed = false): Promise<Record<string, unknown>> {
  return withCall(projectId, async () => {
    const started = now();
    const runtime = runtimeFor(projectId);
    const scene = await Scene.sceneInspect(detailed);
    const layerCount = Number((scene as any).layerCount ?? 0);
    const expectedMinimum = runtime.plan.expectedLayers;
    const identity = resolveAgainstLiveScene(runtime, ((scene as any).layers ?? []) as LiveLayer[]);
    const indexedElements = [...runtime.layers.values()].reduce((sum, elements) => sum + elements.size, 0);
    const result = {
      projectId,
      manifestHash: runtime.plan.hash,
      compiledHash: runtime.compiledHash ?? null,
      revision: runtime.revision,
      dirtyScenes: [...runtime.dirtyScenes],
      expectedMinimumLayers: expectedMinimum,
      actualSceneLayers: layerCount,
      expectedKeyframes: runtime.plan.expectedKeyframes,
      sceneCount: runtime.plan.scenes.length,
      durationFrames: runtime.plan.durationFrames,
      semanticElements: { indexed: indexedElements, resolved: identity.resolved, missing: identity.missing.slice(0, 20), missingCount: identity.missing.length },
      valid: runtime.dirtyScenes.size === 0 && runtime.compiledHash === runtime.plan.hash && layerCount >= expectedMinimum && identity.missing.length === 0,
      inspection: detailed ? scene : { activeComp: (scene as any).activeComp, layerCount },
    };
    addTiming(projectId, 'validationMs', now() - started);
    return result;
  });
}

async function loadPersistedRuntime(projectId: string, activeScenePath: string | undefined): Promise<{ runtime: MotionProjectRuntime; source: string } | null> {
  const candidates = [projectStatePath(projectId), ...(activeScenePath ? [sceneSidecarPath(activeScenePath)] : [])];
  for (const candidate of candidates) {
    const state = await readPersistedState(candidate);
    if (state?.projectId === projectId) return { runtime: hydrateRuntime(state), source: candidate };
  }
  return null;
}

export async function attachCurrentProject(projectId: string): Promise<Record<string, unknown>> {
  return withCall(projectId, async () => {
    const health = await bridgeClient.send<any>('cavalry_health', {}, 10_000).then((response) => response.result).catch(() => null);
    const activeScenePath = health?.activeScenePath || undefined;
    let source = 'memory';
    if (!hasRuntime(projectId)) {
      const loaded = await loadPersistedRuntime(projectId, activeScenePath);
      if (!loaded) throw new Error(`No manifest for '${projectId}' in memory or persisted state. Call motion_project_create first.`);
      registerRuntime(loaded.runtime);
      source = loaded.source;
    }
    const runtime = runtimeFor(projectId);
    const composition = await Comp.compositionGetActive() as any;
    const inspection = await Scene.sceneInspect(false) as any;
    if (!composition || Number(inspection.layerCount ?? 0) < runtime.plan.expectedLayers) {
      throw new Error(`The active Cavalry scene does not satisfy project '${projectId}' structural minimums.`);
    }
    runtime.compId = String(composition.compId ?? composition.layerId ?? composition.id);
    const hadIndex = runtime.layers.size > 0;
    if (!hadIndex) seedIndexFromNames(runtime);
    const identity = resolveAgainstLiveScene(runtime, (inspection.layers ?? []) as LiveLayer[]);
    runtime.layers = identity.layers;
    if (!hadIndex) {
      // No persisted index: scenes whose generated layers all resolve by name
      // are accepted as compiled; the rest must be rebuilt.
      runtime.dirtyScenes = new Set(identity.missingScenes);
      for (const scene of runtime.plan.scenes) if (!runtime.dirtyScenes.has(scene.sceneId)) runtime.compiledSceneHashes.set(scene.sceneId, scene.hash);
    } else {
      // Scenes whose elements can no longer be found must be rebuilt.
      for (const sceneId of identity.missingScenes) runtime.dirtyScenes.add(sceneId);
    }
    runtime.compiledHash = runtime.dirtyScenes.size ? undefined : runtime.plan.hash;
    runtime.scenePath = activeScenePath ?? runtime.scenePath;
    const persisted = await persist(runtime);
    return {
      projectId, compId: runtime.compId, manifestHash: runtime.plan.hash, revision: runtime.revision, attached: true, restoredFrom: source,
      layerCount: inspection.layerCount, semanticElements: { resolved: identity.resolved, resolvedBy: identity.resolvedBy, missing: identity.missing },
      dirtyScenes: [...runtime.dirtyScenes], statePath: persisted.statePath,
    };
  });
}

/** Scene frames used to prove the artifact is not blank: one per scene, after its entrance settles. */
export function projectSampleFrames(scenes: Array<{ startFrame: number; endFrame: number }>, maximum = 8): number[] {
  if (!scenes.length) return [];
  const step = Math.max(1, scenes.length / maximum);
  const chosen: number[] = [];
  for (let index = 0; index < scenes.length && chosen.length < maximum; index += step) {
    const scene = scenes[Math.floor(index)];
    chosen.push(scene.startFrame + Math.floor((scene.endFrame - scene.startFrame) * 0.6));
  }
  return [...new Set(chosen)];
}

export async function renderProject(input: {
  projectId: string; outputDirectory: string; fileName: string; sceneIds?: string[]; background?: boolean;
  waitForCompletion?: boolean; pollIntervalMs?: number;
  strictVisualValidation?: boolean; allowUniformFrames?: boolean;
  maxAttempts?: number; inspectionFrames?: number; segmentFrames?: number;
  signal?: AbortSignal;
}): Promise<Record<string, unknown>> {
  return withCall(input.projectId, async () => {
    const started = now();
    const runtime = runtimeFor(input.projectId);
    if (input.waitForCompletion === false) {
      throw new CavalryError({ code: 'INVALID_VALUE', message: 'motion_project_render only performs supervised, validated renders; waitForCompletion=false is not supported.', operation: 'motion_project_render', suggestion: 'Omit waitForCompletion. For a fire-and-forget export use render_background_start in the standard profile.' });
    }
    if (!runtime.compId) {
      throw new CavalryError({ code: 'NO_ACTIVE_COMPOSITION', message: `Project '${input.projectId}' has not been compiled into Cavalry in this session.`, operation: 'motion_project_render', suggestion: 'Call motion_project_compile, or motion_project_attach_current for a previously compiled scene.' });
    }
    if (runtime.dirtyScenes.size) {
      throw new CavalryError({ code: 'SCENE_DIRTY', message: `Scenes with uncompiled changes would render stale content: ${[...runtime.dirtyScenes].slice(0, 10).join(', ')}${runtime.dirtyScenes.size > 10 ? ', …' : ''}.`, operation: 'motion_project_render', suggestion: 'Call motion_project_compile first.' });
    }
    const outputDirectory = filesystem.assertAllowedPath(path.resolve(input.outputDirectory), 'motion_project_render');
    const selected = input.sceneIds?.length ? runtime.plan.scenes.filter((scene) => input.sceneIds!.includes(scene.sceneId)) : runtime.plan.scenes;
    if (!selected.length) throw new CavalryError({ code: 'INVALID_VALUE', message: 'No render scenes selected.', operation: 'motion_project_render' });
    const startFrame = Math.min(...selected.map((scene) => scene.startFrame));
    const endFrame = Math.max(...selected.map((scene) => scene.endFrame));
    const sampleFrames = projectSampleFrames(selected.filter((scene) => scene.startFrame >= startFrame && scene.endFrame <= endFrame));
    const result = await RenderService.renderJob({
      compId: runtime.compId,
      startFrame, endFrame, outputDirectory, fileName: input.fileName,
      fps: runtime.spec.fps, width: runtime.spec.resolution.width, height: runtime.spec.resolution.height, codec: 'h264',
      sampleFrames,
      ...RenderService.visualTolerance(input, sampleFrames.length),
      maxAttempts: input.maxAttempts,
      inspectionFrames: input.inspectionFrames,
      expectedMinimumLayers: runtime.plan.expectedLayers,
      label: input.projectId,
      signal: input.signal,
    }, input.segmentFrames);
    addTiming(input.projectId, 'renderMs', now() - started);
    runtime.renders.push({ jobId: result.jobId, output: result.output, startFrame, endFrame, manifestHash: runtime.plan.hash, completedAt: new Date().toISOString(), recovered: result.recovered, attempts: result.attempts.length, sceneIds: selected.map((scene) => scene.sceneId) });
    // The checkpoint is what recovery reopens; its sidecar carries the element index.
    const persisted = await persist(runtime, result.checkpointPath ? [result.checkpointPath] : []);
    return { ...result, partial: Boolean(input.sceneIds?.length), sceneIds: selected.map((scene) => scene.sceneId), manifestHash: runtime.plan.hash, outputDirectory, fileName: input.fileName, statePath: persisted.statePath };
  });
}

export async function reviewProject(projectId: string, frames?: number[], scalePercentage = 25): Promise<{ metadata: Record<string, unknown>; images: Array<{ path: string; data: string; mimeType: string }> }> {
  return withCall(projectId, async () => {
    const started = now();
    const runtime = runtimeFor(projectId);
    const selected = frames?.length ? frames : runtime.plan.scenes.slice(0, 20).map((scene) => Math.round((scene.startFrame + scene.endFrame) / 2));
    const rendered = await Preview.previewFrames(selected, scalePercentage);
    const images = await Promise.all(rendered.map(async (frame) => ({ path: frame.filePath, data: await fs.readFile(frame.filePath, 'base64'), mimeType: 'image/png' })));
    addTiming(projectId, 'qcMs', now() - started);
    return { metadata: { projectId, frames: selected, scalePercentage, imageCount: images.length }, images };
  });
}

export function projectMetrics(projectId: string): Record<string, unknown> {
  const runtime = runtimeFor(projectId);
  return {
    ...telemetryFor(projectId),
    manifestHash: runtime.plan.hash,
    compiledHash: runtime.compiledHash ?? null,
    dirtyScenes: [...runtime.dirtyScenes],
    sceneCount: runtime.plan.scenes.length,
    expectedLayers: runtime.plan.expectedLayers,
    expectedKeyframes: runtime.plan.expectedKeyframes,
    compiledOperationCount: runtime.plan.operationCount,
    estimatedLegacyMcpCalls: estimateLegacyCallCount(runtime.plan),
    highLevelTargetCalls: 5,
  };
}

export function projectSpec(projectId: string): MotionProjectSpec {
  return structuredClone(runtimeFor(projectId).spec);
}

export async function defineTypographySystem(projectId: string, styles: NonNullable<MotionProjectSpec['typographyStyles']>, compile = false, dryRun = false): Promise<Record<string, unknown>> {
  const runtime = runtimeFor(projectId);
  const spec = structuredClone(runtime.spec);
  spec.typographyStyles = { ...(spec.typographyStyles ?? {}), ...styles };
  return updateProject(projectId, spec, compile, dryRun);
}

export async function defineComponent(projectId: string, component: NonNullable<MotionProjectSpec['components']>[string]): Promise<Record<string, unknown>> {
  const runtime = runtimeFor(projectId);
  const spec = structuredClone(runtime.spec);
  spec.components = { ...(spec.components ?? {}), [component.id]: component };
  return updateProject(projectId, spec, false, true);
}

export async function applyComponent(projectId: string, componentId: string, sceneIds: string[], instancePrefix?: string, offset?: { x: number; y: number }, compile = true, dryRun = false): Promise<Record<string, unknown>> {
  const runtime = runtimeFor(projectId);
  const component = runtime.spec.components?.[componentId];
  if (!component) throw new Error(`Unknown motion component '${componentId}'.`);
  const spec = structuredClone(runtime.spec);
  for (const scene of spec.scenes.filter((item) => sceneIds.includes(item.id))) {
    const prefix = instancePrefix ?? componentId;
    for (const source of component.elements) {
      const element = structuredClone(source);
      element.id = `${prefix}-${source.id}`;
      element.name = element.name ?? `${scene.id}/${element.id}`;
      if (element.parentId) element.parentId = `${prefix}-${element.parentId}`;
      if (offset) element.position = { x: (element.position?.x ?? 0) + offset.x, y: (element.position?.y ?? 0) + offset.y };
      const existingIndex = scene.elements.findIndex((item) => item.id === element.id);
      if (existingIndex >= 0) scene.elements[existingIndex] = element;
      else scene.elements.push(element);
    }
  }
  return updateProject(projectId, spec, compile, dryRun);
}

export async function applyTransitionSequence(projectId: string, sceneIds: string[], primitive: MotionPrimitive, edge: 'in' | 'out' = 'in', compile = true, dryRun = false): Promise<Record<string, unknown>> {
  const runtime = runtimeFor(projectId);
  const spec = structuredClone(runtime.spec);
  for (const scene of spec.scenes.filter((item) => sceneIds.includes(item.id))) {
    if (edge === 'in') scene.transitionIn = primitive;
    else scene.transitionOut = primitive;
  }
  return updateProject(projectId, spec, compile, dryRun);
}
