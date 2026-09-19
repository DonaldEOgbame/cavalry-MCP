import { bridgeClient } from '../bridge/client.js';
import { identityResolver, LayerIdentity } from '../utils/ids.js';
import { filesystem } from '../utils/filesystem.js';

export interface EditablePoint {
  position: { x: number; y: number };
  inHandle?: { x: number; y: number; selected?: boolean };
  outHandle?: { x: number; y: number; selected?: boolean };
  weightLocked?: boolean;
  angleLocked?: boolean;
  selected?: boolean;
}

export interface EditableContour {
  points: EditablePoint[];
  isClosed: boolean;
}

export async function pathCreate(primitiveType?: string, name?: string, pathObject?: EditableContour[]): Promise<LayerIdentity> {
  const res = await bridgeClient.send<LayerIdentity>('path_create', { primitiveType, name, pathObject });
  const ident = res.result!;
  identityResolver.register(ident);
  return ident;
}

export async function pathInspect(layerId: string, worldSpace?: boolean): Promise<{ layerId: string; worldSpace: boolean; path: EditableContour[] }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('path_inspect', { layerId: resolved, worldSpace });
  return res.result!;
}

export async function pathSetPoints(layerId: string, pathObject: EditableContour[], worldSpace?: boolean): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<Record<string, unknown>>('path_set_points', { layerId: resolved, pathObject, worldSpace });
  return res.result!;
}

export async function shapeCentrePivot(layerId: string, doCentroid?: boolean): Promise<{ layerId: string; centered: boolean }> {
  const resolved = identityResolver.resolveToLayerId(layerId);
  const res = await bridgeClient.send<any>('shape_centre_pivot', { layerId: resolved, doCentroid });
  return res.result!;
}

export async function svgConvertToLayers(filePath: string): Promise<{ filePath: string; layerCount: number; layers: LayerIdentity[] }> {
  const safePath = filesystem.assertAllowedPath(filePath, 'svg_convert_to_layers');
  const res = await bridgeClient.send<any>('svg_convert_to_layers', { filePath: safePath });
  if (res.result?.layers) {
    for (const l of res.result.layers) {
      identityResolver.register(l);
    }
  }
  return res.result!;
}
