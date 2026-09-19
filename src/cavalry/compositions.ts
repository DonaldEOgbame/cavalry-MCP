import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';

export interface CreateCompositionParams {
  name: string;
  width?: number;
  height?: number;
  fps?: number;
  startFrame?: number;
  endFrame?: number;
  makeActive?: boolean;
}

export interface UpdateCompositionParams {
  compId?: string;
  width?: number;
  height?: number;
  fps?: number;
  startFrame?: number;
  endFrame?: number;
  backgroundColor?: { r: number; g: number; b: number; a?: number } | string;
}

export async function compositionList(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('composition_list');
  return res.result!;
}

export async function compositionCreate(params: CreateCompositionParams): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('composition_create', params);
  return res.result!;
}

export async function compositionGetActive(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('composition_get_active');
  return res.result!;
}

export async function compositionSetActive(compId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(compId);
  const res = await bridgeClient.send<Record<string, unknown>>('composition_set_active', { compId: resolved });
  return res.result!;
}

export async function compositionInspect(compId?: string): Promise<Record<string, unknown>> {
  const resolved = compId ? identityResolver.resolveToLayerId(compId) : undefined;
  const res = await bridgeClient.send<Record<string, unknown>>('composition_inspect', { compId: resolved });
  return res.result!;
}

export async function compositionUpdate(params: UpdateCompositionParams): Promise<Record<string, unknown>> {
  const payload = {
    ...params,
    compId: params.compId ? identityResolver.resolveToLayerId(params.compId) : undefined,
  };
  const res = await bridgeClient.send<Record<string, unknown>>('composition_update', payload);
  return res.result!;
}

export async function compositionPrecompose(layerIds: string[], name?: string): Promise<Record<string, unknown>> {
  const resolved = layerIds.map(id => identityResolver.resolveToLayerId(id));
  const res = await bridgeClient.send<Record<string, unknown>>('composition_precompose', { layerIds: resolved, name });
  return res.result!;
}

export async function compositionCreateReference(compId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(compId);
  const res = await bridgeClient.send<Record<string, unknown>>('composition_create_reference', { compId: resolved });
  return res.result!;
}

export async function compositionAddOverride(layerId: string, attrPath: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('composition_add_override', { layerId: resolved, attrPath });
  return res.result!;
}

export async function compositionRemoveOverride(layerId: string, attrPath: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('composition_remove_override', { layerId: resolved, attrPath });
  return res.result!;
}

export async function compositionListOverrides(referenceId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(referenceId);
  const res = await bridgeClient.send<Record<string, unknown>>('composition_list_overrides', { referenceId: resolved });
  return res.result!;
}
