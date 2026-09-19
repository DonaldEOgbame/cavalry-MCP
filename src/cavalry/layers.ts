import { bridgeClient } from '../bridge/client.js';
import { identityResolver, LayerIdentity } from '../utils/ids.js';

export async function layerTypes(includeExperimental?: boolean): Promise<{ count: number; layerTypes: Array<{ name: string; type: string }> }> {
  const res = await bridgeClient.send<any>('layer_types', { includeExperimental });
  return res.result!;
}

export async function layerCreate(layerType: string, name?: string): Promise<LayerIdentity> {
  const res = await bridgeClient.send<LayerIdentity>('layer_create', { layerType, name });
  const ident = res.result!;
  identityResolver.register(ident);
  return ident;
}

export async function layerCreatePrimitive(primitiveType: string, name?: string): Promise<LayerIdentity> {
  const res = await bridgeClient.send<LayerIdentity>('layer_create_primitive', { primitiveType, name });
  const ident = res.result!;
  identityResolver.register(ident);
  return ident;
}

export async function layerInspect(layerId: string, includeAttributes?: boolean): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('layer_inspect', { layerId: resolved, includeAttributes });
  return res.result!;
}

export async function layerList(allScene?: boolean, compId?: string, topLevelOnly?: boolean): Promise<{ count: number; layers: LayerIdentity[] }> {
  const res = await bridgeClient.send<any>('layer_list', {
    allScene,
    compId: compId ? identityResolver.resolveToLayerId(compId) : undefined,
    topLevelOnly,
  });
  if (res.result?.layers) {
    for (const l of res.result.layers) {
      identityResolver.register(l);
    }
  }
  return res.result!;
}

export async function layerListByType(layerType: string, compId?: string): Promise<{ type: string; count: number; layers: LayerIdentity[] }> {
  const res = await bridgeClient.send<any>('layer_list_by_type', {
    layerType,
    compId: compId ? identityResolver.resolveToLayerId(compId) : undefined,
  });
  if (res.result?.layers) {
    for (const l of res.result.layers) {
      identityResolver.register(l);
    }
  }
  return res.result!;
}

export async function layerFind(query: { name?: string; type?: string; pattern?: string }): Promise<{ count: number; layers: LayerIdentity[] }> {
  const res = await bridgeClient.send<any>('layer_find', query);
  if (res.result?.layers) {
    for (const layer of res.result.layers) identityResolver.register(layer);
  }
  return res.result!;
}

export async function layerRename(layerId: string, newName: string): Promise<LayerIdentity> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<LayerIdentity>('layer_rename', { layerId: resolved, newName });
  const ident = res.result!;
  identityResolver.register(ident);
  return ident;
}

export async function layerDuplicate(layerId: string): Promise<LayerIdentity> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<LayerIdentity>('layer_duplicate', { layerId: resolved });
  const ident = res.result!;
  identityResolver.register(ident);
  return ident;
}

export async function layerDelete(layerIds: string | string[]): Promise<{ deletedCount: number; deletedIds: string[] }> {
  const ids = Array.isArray(layerIds) ? layerIds : [layerIds];
  const resolved = ids.map(id => identityResolver.resolveToLayerId(id));
  const res = await bridgeClient.send<any>('layer_delete', { layerIds: resolved });
  for (const id of ids) {
    identityResolver.invalidate(id);
  }
  return res.result!;
}

export async function layerParent(childLayerId: string, parentLayerId: string): Promise<{ child: string; parent: string }> {
  const child = identityResolver.resolveToLayerId(childLayerId);
  const parent = identityResolver.resolveToLayerId(parentLayerId);
  const res = await bridgeClient.send<any>('layer_parent', { childLayerId: child, parentLayerId: parent });
  return res.result!;
}

export async function layerUnparent(layerId: string): Promise<{ layerId: string; parent: string }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_unparent', { layerId: resolved });
  return res.result!;
}

export async function layerChildren(layerId: string): Promise<{ layerId: string; count: number; children: LayerIdentity[] }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_children', { layerId: resolved });
  return res.result!;
}

export async function layerParentInfo(layerId: string): Promise<{ layerId: string; parent: LayerIdentity | null }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_parent_info', { layerId: resolved });
  return res.result!;
}

export async function layerReorder(layerId: string, underLayerId: string): Promise<{ layerId: string; underLayerId: string }> {
  const l = identityResolver.resolveToLayerId(layerId);
  const u = identityResolver.resolveToLayerId(underLayerId);
  const res = await bridgeClient.send<any>('layer_reorder', { layerId: l, underLayerId: u });
  return res.result!;
}

export async function layerSelect(layerIds: string[]): Promise<{ selectedIds: string[] }> {
  const resolved = layerIds.map(id => identityResolver.resolveToLayerId(id));
  const res = await bridgeClient.send<any>('layer_select', { layerIds: resolved });
  return res.result!;
}

export async function layerGetSelection(sortByHierarchy?: boolean): Promise<{ count: number; selection: LayerIdentity[] }> {
  const res = await bridgeClient.send<any>('layer_get_selection', { sortByHierarchy });
  if (res.result?.selection) {
    for (const layer of res.result.selection) identityResolver.register(layer);
  }
  return res.result!;
}

export async function layerBoundingBox(layerId: string, worldSpace?: boolean): Promise<{ layerId: string; worldSpace: boolean; boundingBox: any }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_bounding_box', { layerId: resolved, worldSpace });
  return res.result!;
}

export async function layerSetInFrame(layerId: string, frame: number): Promise<{ layerId: string; inFrame: number }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_set_in_frame', { layerId: resolved, frame });
  return res.result!;
}

export async function layerSetOutFrame(layerId: string, frame: number): Promise<{ layerId: string; outFrame: number }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_set_out_frame', { layerId: resolved, frame });
  return res.result!;
}

export async function layerVisibility(layerId: string, visible?: boolean): Promise<{ layerId: string; visible: boolean }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_visibility', { layerId: resolved, visible });
  return res.result!;
}

export async function layerSolo(layerId: string, solo: boolean): Promise<{ layerId: string; soloed: boolean }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_solo', { layerId: resolved, solo });
  return res.result!;
}

export async function layerIsShape(layerId: string): Promise<{ layerId: string; isShape: boolean }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('layer_is_shape', { layerId: resolved });
  return res.result!;
}
