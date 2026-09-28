import { bridgeClient } from '../bridge/client.js';
import { identityResolver } from '../utils/ids.js';
import { attributeSetMany } from './attributes.js';
import crypto from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { classifyFrameSamples, validateMediaMetadata } from './render-validation.js';

const execFileAsync = promisify(execFile);
type RenderState = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'UNKNOWN_AFTER_BACKGROUND_START' | 'FAILED';
interface TrackedRender {
  [key: string]: unknown;
  itemId: string;
  jobId: string;
  state: RenderState;
  startedAt: string;
  updatedAt: string;
  progress: number | null;
  reliable: boolean;
  error?: string;
}

const trackedRenders = new Map<string, TrackedRender>();
const itemJobs = new Map<string, string>();
const renderSettings = new Map<string, Record<string, unknown>>();

function track(itemId: string, state: RenderState, reliable: boolean, error?: string, jobId = itemJobs.get(itemId) ?? crypto.randomUUID()): TrackedRender {
  const previous = trackedRenders.get(jobId);
  const now = new Date().toISOString();
  const progress = state === 'COMPLETED' ? 100 : state === 'RUNNING' ? 0 : null;
  const item = { itemId, jobId, state, startedAt: previous?.startedAt ?? now, updatedAt: now, progress, reliable, ...(error ? { error } : {}) };
  trackedRenders.set(jobId, item);
  itemJobs.set(itemId, jobId);
  return item;
}

export async function validateRenderedFile(filePath: string, settings: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const info = await stat(filePath);
  if (info.size <= 0) throw new Error('Rendered output is empty.');
  let media: Record<string, unknown> | null = null;
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,nb_frames,width,height,pix_fmt,channels,sample_rate', '-of', 'json', filePath]);
    media = JSON.parse(stdout);
    const streams = (media as any).streams ?? [];
    const expectedFrames = Number(settings.expectedFrameCount);
    const expectedFps = Number(settings.expectedFps);
    const mediaValidation = validateMediaMetadata(media, {
      video: settings.expectedVideo === true,
      codec: typeof settings.expectedCodec === 'string' ? settings.expectedCodec : undefined,
      width: Number.isFinite(Number(settings.expectedWidth)) ? Number(settings.expectedWidth) : undefined,
      height: Number.isFinite(Number(settings.expectedHeight)) ? Number(settings.expectedHeight) : undefined,
      durationSeconds: Number.isFinite(expectedFrames) && Number.isFinite(expectedFps) && expectedFps > 0 ? expectedFrames / expectedFps : undefined,
      durationToleranceSeconds: Number.isFinite(expectedFps) && expectedFps > 0 ? Math.max(0.1, 1.5 / expectedFps) : undefined,
    });
    if (!mediaValidation.valid) throw new Error(`Rendered media validation failed: ${mediaValidation.errors.join(', ')}`);
    (media as any).validation = mediaValidation;
    if (streams.some((stream: any) => stream.codec_type === 'video')) {
      const duration = Number((media as any).format?.duration || 0);
      const sampleTimes = duration > 0 ? [0, duration / 2, Math.max(0, duration - 0.05)] : [0];
      const luminance: number[] = [];
      for (const sampleTime of sampleTimes) {
        const probe = await execFileAsync('ffmpeg', ['-v', 'error', '-ss', String(sampleTime), '-i', filePath, '-frames:v', '1', '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-']);
        const match = probe.stdout.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
        if (match) luminance.push(Number(match[1]));
      }
      const frameClassification = classifyFrameSamples(luminance);
      const allowUniformFrames = settings.allowUniformFrames === true;
      if ((frameClassification === 'uniform-dark' || frameClassification === 'uniform-light') && settings.strictVisualValidation === true && !allowUniformFrames) {
        throw new Error(`Representative-frame validation found ${frameClassification} frames; set allowUniformFrames=true only when this is intentional.`);
      }
      (media as any).representativeFrameLuminance = luminance;
      (media as any).frameClassification = frameClassification;
      (media as any).visualContentVerified = frameClassification === 'content';
    }
  } catch (error) {
    if (/\.(?:json|svg)$/i.test(filePath)) {
      media = { kind: path.extname(filePath).slice(1), structurallyVerified: info.size > 0 };
    } else if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Without ffprobe nothing about the media has been verified.
      throw new Error('ffprobe/ffmpeg are not installed, so the rendered media cannot be validated.');
    } else {
      throw error;
    }
  }
  return { verified: true, path: filePath, size: info.size, modifiedAt: info.mtime.toISOString(), metadata: media, representativeFramesDecoded: media !== null };
}

async function validateRenderOutput(itemId: string, startedAt: number): Promise<Record<string, unknown>> {
  const settings = renderSettings.get(itemId) ?? {};
  const directory = typeof settings.filePath === 'string' ? settings.filePath : undefined;
  const prefix = typeof settings.fileName === 'string' ? settings.fileName : undefined;
  if (!directory || !prefix) return { verified: null, reason: 'output_path_not_configured_through_mcp' };
  const candidates = (await readdir(directory)).filter((name) => name.startsWith(prefix));
  const inspected = await Promise.all(candidates.map(async (name) => ({ path: path.join(directory, name), info: await stat(path.join(directory, name)) })));
  const fresh = inspected.filter(({ info }) => info.mtimeMs >= startedAt && info.size > 0).sort((a, b) => b.info.mtimeMs - a.info.mtimeMs);
  if (!fresh.length) throw new Error('Render returned without creating a fresh, non-empty output file.');
  return validateRenderedFile(fresh[0].path, settings);
}

async function waitForRenderOutput(itemId: string, startedAt: number, pollIntervalMs = 2_000): Promise<Record<string, unknown>> {
  const timeoutMs = Number(process.env.CAVALRY_RENDER_TIMEOUT_MS || 30 * 60 * 1000);
  let lastError: unknown;
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      return await validateRenderOutput(itemId, startedAt);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Timed out waiting for a fresh render output.');
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
  const normalized = { ...settings };
  const validationSettings = {
    allowUniformFrames: settings.allowUniformFrames === true,
    strictVisualValidation: settings.strictVisualValidation === true,
    expectedVideo: settings.expectedVideo === true,
    expectedCodec: settings.expectedCodec,
    expectedWidth: settings.expectedWidth,
    expectedHeight: settings.expectedHeight,
    expectedFrameCount: settings.expectedFrameCount,
    expectedFps: settings.expectedFps,
  };
  for (const key of Object.keys(validationSettings)) delete normalized[key];
  if (typeof settings.startFrame === 'number' || typeof settings.endFrame === 'number') {
    const previous = renderSettings.get(resolved) ?? {};
    // Cavalry 2.7.2 enum value 2 selects the explicit custom range. Value 1
    // keeps the Render Manager's default range even when frameRange reads back
    // with the supplied coordinates.
    normalized.frameRangeMode = 2;
    normalized.frameRange = {
      x: settings.startFrame ?? (previous.frameRange as any)?.x ?? 0,
      y: settings.endFrame ?? (previous.frameRange as any)?.y ?? settings.startFrame ?? 0,
    };
    delete normalized.startFrame;
    delete normalized.endFrame;
  }
  // Large compiled scenes can make Render Manager mutation slower than an
  // ordinary layer edit even before rendering begins.
  const result = await attributeSetMany(resolved, normalized, 120_000);
  renderSettings.set(resolved, { ...(renderSettings.get(resolved) ?? {}), ...normalized, ...validationSettings });
  return { ...result, resolvedFrameRange: normalized.frameRange, frameRangeMode: normalized.frameRangeMode };
}

export async function renderStart(itemId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(itemId);
  const jobId = crypto.randomUUID();
  const startedAt = Date.now();
  if (!renderSettings.has(resolved)) {
    try {
      const inspection = await bridgeClient.send<any>('render_item_inspect', { itemId: resolved, attributes: ['filePath', 'fileName', 'frameRange', 'frameRangeMode'] });
      const values = inspection.result?.values ?? {};
      renderSettings.set(resolved, { filePath: values.filePath, fileName: values.fileName, frameRange: values.frameRange, frameRangeMode: values.frameRangeMode });
    } catch {}
  }
  track(resolved, 'RUNNING', true, undefined, jobId);
  try {
    // api.render() can own the host for the whole render; the default 15s
    // bridge timeout would report failure while Cavalry is still rendering.
    const res = await bridgeClient.send<Record<string, unknown>>('render_start', { itemId: resolved, jobId }, Number(process.env.CAVALRY_RENDER_TIMEOUT_MS || 30 * 60 * 1000));
    // Cavalry 2.7.2 can return from api.render() after creating the output
    // container but before the encoder has flushed any media bytes.
    const outputVerification = await waitForRenderOutput(resolved, startedAt);
    return { ...res.result!, jobId, outputVerification, supervision: track(resolved, 'COMPLETED', true, undefined, jobId) };
  } catch (error) {
    track(resolved, 'FAILED', true, error instanceof Error ? error.message : String(error), jobId);
    throw error;
  }
}

export async function renderStartAll(): Promise<Record<string, unknown>> {
  const jobId = crypto.randomUUID();
  track('*', 'RUNNING', true, undefined, jobId);
  const res = await bridgeClient.send<Record<string, unknown>>('render_start_all');
  return { ...res.result!, jobId, supervision: track('*', 'COMPLETED', true, undefined, jobId) };
}

export async function renderCancel(): Promise<Record<string, unknown>> {
  const res = await bridgeClient.send<Record<string, unknown>>('render_cancel');
  for (const item of trackedRenders.values()) {
    if (item.state === 'RUNNING' || item.state === 'UNKNOWN_AFTER_BACKGROUND_START') track(item.itemId, 'CANCELLED', true, undefined, item.jobId);
  }
  return { ...res.result!, tracked: [...trackedRenders.values()] };
}

export async function renderBackgroundStart(itemId: string): Promise<Record<string, unknown>> {
  const resolved = identityResolver.resolveToLayerId(itemId);
  const jobId = crypto.randomUUID();
  track(resolved, 'RUNNING', false, undefined, jobId);
  const res = await bridgeClient.send<Record<string, unknown>>('render_background_start', { itemId: resolved });
  return { ...res.result!, jobId, supervision: track(resolved, 'UNKNOWN_AFTER_BACKGROUND_START', false, undefined, jobId) };
}

async function refreshBackground(item: TrackedRender): Promise<TrackedRender> {
  if (item.state !== 'UNKNOWN_AFTER_BACKGROUND_START') return item;
  try {
    await validateRenderOutput(item.itemId, Date.parse(item.startedAt));
    return track(item.itemId, 'COMPLETED', true, undefined, item.jobId);
  } catch (error) {
    const timeoutMs = Number(process.env.CAVALRY_RENDER_TIMEOUT_MS || 30 * 60 * 1000);
    if (Date.now() - Date.parse(item.startedAt) > timeoutMs) {
      return track(item.itemId, 'FAILED', true, error instanceof Error ? error.message : String(error), item.jobId);
    }
    return item;
  }
}

export async function renderStatus(itemIdOrJobId?: string): Promise<Record<string, unknown>> {
  if (itemIdOrJobId) {
    const direct = trackedRenders.get(itemIdOrJobId);
    const resolved = direct ? direct.itemId : identityResolver.resolveToLayerId(itemIdOrJobId);
    const item = direct ?? trackedRenders.get(itemJobs.get(resolved) ?? '');
    return item ? refreshBackground(item) : {
      itemId: resolved,
      state: 'NOT_STARTED_BY_MCP',
      progress: null,
      reliable: false,
      message: 'Cavalry 2.7.2 exposes no global render-status API; only MCP-launched renders can be tracked.',
    };
  }
  return { renders: await Promise.all([...trackedRenders.values()].map(refreshBackground)), progressAvailable: true };
}

export async function renderIsActive(itemId?: string): Promise<Record<string, unknown>> {
  const status = await renderStatus(itemId) as any;
  if (itemId) {
    const active = status.state === 'RUNNING' || status.state === 'QUEUED' ? true
      : status.state === 'COMPLETED' || status.state === 'CANCELLED' || status.state === 'FAILED' ? false
      : null;
    return { itemId: status.itemId, jobId: status.jobId, active, state: status.state, reliable: status.reliable, progress: status.progress };
  }
  const renders = status.renders as TrackedRender[];
  return { active: renders.some(item => item.state === 'RUNNING' || item.state === 'QUEUED') || (renders.length ? false : null), renders };
}

export async function renderWait(itemId: string): Promise<Record<string, unknown>> {
  const status = await renderStatus(itemId) as any;
  if (status.state === 'COMPLETED') return { completed: true, status };
  if (status.state === 'CANCELLED' || status.state === 'FAILED') return { completed: false, status };
  return {
    completed: null,
    status,
    message: 'Reliable waiting is unavailable for background or externally started renders in Cavalry 2.7.2; no percentage is fabricated.',
  };
}

export async function shutdownRenderTracking(): Promise<void> {
  const active = [...trackedRenders.values()].some((item) => item.state === 'RUNNING' || item.state === 'UNKNOWN_AFTER_BACKGROUND_START');
  if (active) {
    try { await bridgeClient.send('render_cancel', {}, 1_000); } catch {}
  }
  trackedRenders.clear();
  itemJobs.clear();
  renderSettings.clear();
}
