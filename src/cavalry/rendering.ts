import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';
import { attributeSetMany } from './attributes.js';

export async function renderQueueList(): Promise<{ count: number; items: Array<{ id: string; name: string }> }> {
  const res = await bridgeClient.send<any>('render_queue_list');
  return res.result!;
}

export async function renderQueueAdd(compId?: string): Promise<{ renderQueueItemId: string; compId: string }> {
  const resolved = compId ? identityResolver.resolveToLayerId(compId) : undefined;
  const res = await bridgeClient.send<any>('render_queue_add', { compId: resolved });
  return res.result!;
}

export async function renderQueueConfigure(itemId: string, settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(itemId);
  return attributeSetMany(resolved, settings);
}

export async function renderStart(itemId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(itemId);
  const res = await bridgeClient.send<Record<string, unknown>>('render_start', { itemId: resolved });
  return res.result!;
}

export async function renderStartAll(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('render_start_all');
  return res.result!;
}

export async function renderCancel(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('render_cancel');
  return res.result!;
}
