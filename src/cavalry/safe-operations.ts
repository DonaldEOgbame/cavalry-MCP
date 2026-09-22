import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';
import { sceneCheckpoint, sceneRestoreCheckpoint } from './scene.js';
import { layerDuplicate, layerRename, layerSetInFrame, layerSetOutFrame, layerVisibility } from './layers.js';
import { keyframeCreate, keyframeMagicEasing, keyframeSetInterpolation } from './animation.js';

type PathValue = Record<string, any> | any[];

function interpolateValue(from: any, to: any, t: number): any {
  if (typeof from === 'number' && typeof to === 'number') return from + ((to - from) * t);
  if (Array.isArray(from) && Array.isArray(to)) {
    if (from.length !== to.length) throw new Error('Path topology mismatch: array lengths differ.');
    return from.map((value, index) => interpolateValue(value, to[index], t));
  }
  if (from && to && typeof from === 'object' && typeof to === 'object') {
    const fromKeys = Object.keys(from).sort();
    const toKeys = Object.keys(to).sort();
    if (fromKeys.join('\0') !== toKeys.join('\0')) {
      throw new Error('Path topology mismatch: object fields differ.');
    }
    return Object.fromEntries(fromKeys.map(key => [key, interpolateValue(from[key], to[key], t)]));
  }
  return t < 0.5 ? from : to;
}

export function interpolatePath(from: PathValue, to: PathValue, t: number): PathValue {
  if (t < 0 || t > 1) throw new Error('Interpolation t must be between 0 and 1.');
  return interpolateValue(from, to, t);
}

export interface SafePathKeyframe { frame: number; pathObject: PathValue }

export async function pathAnimationSafe(
  layerId: string,
  keyframes: SafePathKeyframe[],
  sampleEvery: number = 1,
  namePrefix: string = 'Safe Path',
): Promise<Record<string, unknown>> {
  if (keyframes.length < 2) throw new Error('At least two path keyframes are required.');
  if (!Number.isInteger(sampleEvery) || sampleEvery < 1) throw new Error('sampleEvery must be a positive integer.');
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  if (sorted.some((item, index) => index > 0 && item.frame <= sorted[index - 1].frame)) {
    throw new Error('Path keyframe frames must be unique and increasing.');
  }

  const samples: Array<{ frame: number; path: PathValue }> = [];
  for (let segment = 0; segment < sorted.length - 1; segment += 1) {
    const from = sorted[segment];
    const to = sorted[segment + 1];
    const span = to.frame - from.frame;
    for (let frame = from.frame; frame < to.frame; frame += sampleEvery) {
      if (samples.some(item => item.frame === frame)) continue;
      samples.push({ frame, path: interpolatePath(from.pathObject, to.pathObject, (frame - from.frame) / span) });
    }
  }
  samples.push({ frame: sorted.at(-1)!.frame, path: sorted.at(-1)!.pathObject });
  if (samples.length > 300) throw new Error('Safe path animation is capped at 300 sampled frames; increase sampleEvery.');

  const resolved = identityResolver.resolveToLayerId(layerId);
  const checkpoint = await sceneCheckpoint();
  const layers: Array<{ frame: number; layerId: string; uuid?: string }> = [];
  try {
    for (const sample of samples) {
      const duplicate = await layerDuplicate(resolved);
      await layerRename(duplicate.layerId, `${namePrefix} ${String(sample.frame).padStart(4, '0')}`);
      await bridgeClient.send('path_set_editable', {
        layerId: duplicate.layerId,
        pathObject: sample.path,
        worldSpace: false,
      });
      await layerSetInFrame(duplicate.layerId, sample.frame);
      await layerSetOutFrame(duplicate.layerId, sample.frame);
      layers.push({ frame: sample.frame, layerId: duplicate.layerId, uuid: duplicate.uuid });
    }
    await layerVisibility(resolved, false);
    return {
      mode: 'sampled-layer-sequence',
      sourceLayerId: resolved,
      sourceHidden: true,
      sampleEvery,
      frameCount: layers.length,
      layers,
      nativePathKeyframesUsed: false,
      checkpointId: checkpoint.checkpointId,
    };
  } catch (error) {
    await sceneRestoreCheckpoint(checkpoint.data);
    throw error;
  }
}

export async function pathMorphSafe(
  layerId: string,
  startFrame: number,
  endFrame: number,
  fromPath: PathValue,
  toPath: PathValue,
  sampleEvery: number = 1,
): Promise<Record<string, unknown>> {
  return pathAnimationSafe(layerId, [
    { frame: startFrame, pathObject: fromPath },
    { frame: endFrame, pathObject: toPath },
  ], sampleEvery, 'Safe Morph');
}

export interface CameraShot {
  frame: number;
  position?: Record<string, number>;
  rotation?: number;
  zoom?: number;
  lookAt?: Record<string, number>;
}

export async function cameraCut(layerId: string, shot: CameraShot): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const keyed: string[] = [];
  for (const [attrPath, value] of Object.entries({ position: shot.position, rotation: shot.rotation, zoom: shot.zoom })) {
    if (value === undefined) continue;
    await keyframeCreate(resolved, attrPath, shot.frame, value);
    await keyframeSetInterpolation(resolved, attrPath, shot.frame, 2);
    keyed.push(attrPath);
  }
  if (shot.lookAt) {
    await bridgeClient.send('camera_look_at', { layerId: resolved, position: shot.lookAt });
    keyed.push('lookAt');
  }
  return { layerId: resolved, frame: shot.frame, keyed, interpolation: 'hold' };
}

export async function cameraTransition(
  layerId: string,
  from: CameraShot,
  to: CameraShot,
  easing: string = 'SlowOut',
): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const keyed: string[] = [];
  for (const attrPath of ['position', 'rotation', 'zoom'] as const) {
    const fromValue = from[attrPath];
    const toValue = to[attrPath];
    if (fromValue === undefined || toValue === undefined) continue;
    await keyframeCreate(resolved, attrPath, from.frame, fromValue);
    await keyframeCreate(resolved, attrPath, to.frame, toValue);
    await keyframeMagicEasing(resolved, attrPath, from.frame, easing);
    keyed.push(attrPath);
  }
  return { layerId: resolved, startFrame: from.frame, endFrame: to.frame, keyed, easing };
}

export async function cameraSequenceCreate(
  layerId: string,
  shots: CameraShot[],
): Promise<Record<string, unknown>> {
  if (shots.length < 1) throw new Error('At least one camera shot is required.');
  const ordered = [...shots].sort((a, b) => a.frame - b.frame);
  const cuts = [];
  for (const shot of ordered) cuts.push(await cameraCut(layerId, shot));
  return { layerId: identityResolver.resolveToLayerId(layerId), mode: 'single-camera-hold-keyframes', shots: cuts };
}
