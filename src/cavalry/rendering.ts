import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';
import { attributeSetMany } from './attributes.js';

type RenderState = 'STARTING' | 'COMPLETED' | 'CANCELLED' | 'UNKNOWN_AFTER_BACKGROUND_START' | 'FAILED';
interface TrackedRender {
  [key: string]: unknown;
  itemId: string;
  state: RenderState;
  startedAt: string;
  updatedAt: string;
  progress: null;
  reliable: boolean;
  error?: string;
}

const trackedRenders = new Map<string, TrackedRender>();

function track(itemId: string, state: RenderState, reliable: boolean, error?: string): TrackedRender {
  const previous = trackedRenders.get(itemId);
  const now = new Date().toISOString();
  const item = { itemId, state, startedAt: previous?.startedAt ?? now, updatedAt: now, progress: null, reliable, ...(error ? { error } : {}) };
  trackedRenders.set(itemId, item);
  return item;
}

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
  track(resolved, 'STARTING', true);
  try {
    const res = await bridgeClient.send<Record<string, unknown>>('render_start', { itemId: resolved });
    return { ...res.result!, supervision: track(resolved, 'COMPLETED', true) };
  } catch (error) {
    track(resolved, 'FAILED', true, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function renderStartAll(): Promise<Record<string, unknown>> {
  track('*', 'STARTING', true);
  const res = await bridgeClient.send<Record<string, unknown>>('render_start_all');
  return { ...res.result!, supervision: track('*', 'COMPLETED', true) };
}

export async function renderCancel(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('render_cancel');
  for (const item of trackedRenders.values()) {
    if (item.state === 'STARTING' || item.state === 'UNKNOWN_AFTER_BACKGROUND_START') track(item.itemId, 'CANCELLED', true);
  }
  return { ...res.result!, tracked: [...trackedRenders.values()] };
}

export async function renderBackgroundStart(itemId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(itemId);
  track(resolved, 'STARTING', false);
  const res = await bridgeClient.send<Record<string, unknown>>('render_background_start', { itemId: resolved });
  return { ...res.result!, supervision: track(resolved, 'UNKNOWN_AFTER_BACKGROUND_START', false) };
}

export function renderStatus(itemId?: string): Record<string, unknown> {
  if (itemId) {
    const resolved = identityResolver.resolveToLayerId(itemId);
    return trackedRenders.get(resolved) ?? {
      itemId: resolved,
      state: 'NOT_STARTED_BY_MCP',
      progress: null,
      reliable: false,
      message: 'Cavalry 2.7.2 exposes no global render-status API; only MCP-launched renders can be tracked.',
    };
  }
  return { renders: [...trackedRenders.values()], progressAvailable: false };
}

export function renderIsActive(itemId?: string): Record<string, unknown> {
  const status = renderStatus(itemId) as any;
  if (itemId) {
    const active = status.state === 'STARTING' ? true
      : status.state === 'COMPLETED' || status.state === 'CANCELLED' || status.state === 'FAILED' ? false
      : null;
    return { itemId: status.itemId, active, state: status.state, reliable: status.reliable, progress: null };
  }
  const renders = status.renders as TrackedRender[];
  return { active: renders.some(item => item.state === 'STARTING') || (renders.length ? false : null), renders, progress: null };
}

export function renderWait(itemId: string): Record<string, unknown> {
  const status = renderStatus(itemId) as any;
  if (status.state === 'COMPLETED') return { completed: true, status };
  if (status.state === 'CANCELLED' || status.state === 'FAILED') return { completed: false, status };
  return {
    completed: null,
    status,
    message: 'Reliable waiting is unavailable for background or externally started renders in Cavalry 2.7.2; no percentage is fabricated.',
  };
}
