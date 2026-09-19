import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';

export interface MarkerInfo {
  markerId: string;
  time: number;
  label?: string;
  color?: string;
}

export async function markerList(): Promise<{ count: number; markers: MarkerInfo[] }> {
  const res = await bridgeClient.send<any>('marker_list');
  return res.result!;
}

export async function markerCreate(frame: number, label?: string, color?: string): Promise<MarkerInfo> {
  const res = await bridgeClient.send<MarkerInfo>('marker_create', { frame, label, color });
  return res.result!;
}

export async function markerUpdate(markerId: string, updates: { frame?: number; label?: string; color?: string }): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(markerId);
  const res = await bridgeClient.send<Record<string, unknown>>('marker_update', { markerId: resolved, ...updates });
  return res.result!;
}

export async function markerMove(markerId: string, frame: number): Promise<{ markerId: string; frame: number }> {
  const resolved = identityResolver.resolveToLayerId(markerId);
  const res = await bridgeClient.send<any>('marker_move', { markerId: resolved, frame });
  return res.result!;
}

export async function markerDelete(markerId: string): Promise<{ markerId: string; deleted: boolean }> {
  const resolved = identityResolver.resolveToLayerId(markerId);
  const res = await bridgeClient.send<any>('marker_delete', { markerId: resolved });
  return res.result!;
}
