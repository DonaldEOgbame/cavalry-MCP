import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';

export interface KeyframeTangentOptions {
  frame: number;
  inHandle?: boolean;
  outHandle?: boolean;
  angleLocked?: boolean;
  weightLocked?: boolean;
  angle?: number;
  weight?: number;
  xValue?: number;
  yValue?: number;
}

export interface KeyframeVelocityOptions {
  frame: number;
  leftSpeed?: number;
  rightSpeed?: number;
  leftInfluence?: number;
  rightInfluence?: number;
}

export async function timelineGetFrame(): Promise<{ frame: number }> {
  const res = await bridgeClient.send<{ frame: number }>('timeline_get_frame');
  return res.result!;
}

export async function timelineSetFrame(frame: number): Promise<{ frame: number }> {
  const res = await bridgeClient.send<{ frame: number }>('timeline_set_frame', { frame });
  return res.result!;
}

export async function timelinePlay(): Promise<{ playing: boolean }> {
  const res = await bridgeClient.send<{ playing: boolean }>('timeline_play');
  return res.result!;
}

export async function timelineStop(): Promise<{ playing: boolean }> {
  const res = await bridgeClient.send<{ playing: boolean }>('timeline_stop');
  return res.result!;
}

export async function keyframeList(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string; keyframes: number[] }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('keyframe_list', { layerId: resolved, attrPath });
  return res.result!;
}

export async function keyframeCreate(layerId: string, attrPath: string, frame: number, value: unknown): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_create', { layerId: resolved, attrPath, frame, value });
  return res.result!;
}

export async function keyframeUpdate(layerId: string, attrPath: string, frame: number, newValue: unknown): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_update', { layerId: resolved, attrPath, frame, newValue });
  return res.result!;
}

export async function keyframeMove(layerId: string, attrPath: string, fromFrame: number, toFrame: number): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_move', { layerId: resolved, attrPath, fromFrame, toFrame });
  return res.result!;
}

export async function keyframeDelete(layerId: string, attrPath: string, frame: number): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_delete', { layerId: resolved, attrPath, frame });
  return res.result!;
}

export async function keyframeDeleteAnimation(layerId: string, attrPath: string): Promise<{ layerId: string; attrPath: string; deletedCount: number }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('keyframe_delete_animation', { layerId: resolved, attrPath });
  return res.result!;
}

export async function keyframeSetInterpolation(layerId: string, attrPath: string, frame: number, type: 0 | 1 | 2): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_set_interpolation', { layerId: resolved, attrPath, frame, type });
  return res.result!;
}

export async function keyframeSetTangents(layerId: string, attrPath: string, options: KeyframeTangentOptions): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_set_tangents', {
    layerId: resolved,
    attrPath,
    ...options,
  });
  return res.result!;
}

export async function keyframeSetVelocity(layerId: string, attrPath: string, options: KeyframeVelocityOptions): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_set_velocity', {
    layerId: resolved,
    attrPath,
    ...options,
  });
  return res.result!;
}

export async function keyframeClearVelocity(layerId: string, attrPath: string, frame: number): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_clear_velocity', { layerId: resolved, attrPath, frame });
  return res.result!;
}

export async function keyframeMagicEasing(layerId: string, attrPath: string, frame: number, easingType: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('keyframe_magic_easing', { layerId: resolved, attrPath, frame, easingType });
  return res.result!;
}
