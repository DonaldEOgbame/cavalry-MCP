import path from 'node:path';
import { bridgeClient } from '../bridge/client.js';
import { CavalryError } from '../mcp/errors.js';
import { filesystem } from '../utils/filesystem.js';
import { identityResolver } from '../utils/ids.js';
import * as Scene from '../cavalry/scene.js';
import { RenderJobResult, RenderJobSpec, runSegmentedRender, runSupervisedRender } from './pipeline.js';

export interface VisualPolicy {
  strictVisualValidation?: boolean;
  allowUniformFrames?: boolean;
}

/** Strict by default: blank or frozen samples fail the render unless explicitly allowed. */
export function visualTolerance(policy: VisualPolicy, sampleCount: number): Pick<RenderJobSpec, 'allowBlankFrames' | 'allowStaticContent'> {
  const strict = policy.strictVisualValidation !== false;
  return {
    allowBlankFrames: policy.allowUniformFrames === true || !strict ? sampleCount : 0,
    allowStaticContent: policy.allowUniformFrames === true || !strict,
  };
}

export async function renderJob(spec: RenderJobSpec, segmentFrames?: number): Promise<RenderJobResult> {
  return segmentFrames ? runSegmentedRender(spec, segmentFrames) : runSupervisedRender(spec);
}

export interface RenderSceneInput extends VisualPolicy {
  scenePath?: string;
  compId?: string;
  startFrame?: number;
  endFrame?: number;
  outputDirectory: string;
  fileName: string;
  sampleFrames?: number[];
  maxAttempts?: number;
  inspectionFrames?: number;
  segmentFrames?: number;
  signal?: AbortSignal;
}

function dimension(value: unknown, axis: 'x' | 'y'): number | undefined {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const number = Number(record[axis] ?? record[axis === 'x' ? 'width' : 'height']);
    return Number.isFinite(number) && number > 0 ? number : undefined;
  }
  return undefined;
}

/**
 * Renders an arbitrary scene through the supervised pipeline, independent of
 * the motion compiler. Used to isolate host/render-manager problems from
 * compiler problems (render isolation and torture harnesses).
 */
export async function renderSceneVerified(input: RenderSceneInput): Promise<RenderJobResult & { scenePath: string | null; compId: string }> {
  const outputDirectory = filesystem.assertAllowedPath(path.resolve(input.outputDirectory), 'render_scene_verified');
  if (input.scenePath) await Scene.sceneOpen(input.scenePath, true);
  if (input.compId) await bridgeClient.send('composition_set_active', { compId: identityResolver.resolveToLayerId(input.compId) }, 15_000);
  const composition = (await bridgeClient.send<any>('composition_get_active', {}, 15_000)).result;
  if (!composition?.compId) throw new CavalryError({ code: 'NO_ACTIVE_COMPOSITION', message: 'No active composition to render.', operation: 'render_scene_verified' });
  const width = dimension(composition.resolution, 'x');
  const height = dimension(composition.resolution, 'y');
  const fps = Number(composition.fps);
  if (!width || !height || !Number.isFinite(fps) || fps <= 0) {
    throw new CavalryError({ code: 'INVALID_VALUE', message: `Composition settings are unreadable (resolution=${JSON.stringify(composition.resolution)}, fps=${composition.fps}).`, operation: 'render_scene_verified' });
  }
  const startFrame = input.startFrame ?? Number(composition.frameRange?.x ?? 0);
  const endFrame = input.endFrame ?? Number(composition.frameRange?.y ?? startFrame);
  const layerCount = Number((await bridgeClient.send<any>('scene_inspect', { detailed: false }, 60_000)).result?.layerCount ?? 0);
  const samples = input.sampleFrames?.length ? input.sampleFrames : undefined;
  const result = await renderJob({
    compId: String(composition.compId),
    startFrame, endFrame, outputDirectory, fileName: input.fileName,
    fps, width, height, codec: 'h264',
    sampleFrames: samples,
    ...visualTolerance(input, samples?.length ?? 8),
    maxAttempts: input.maxAttempts,
    inspectionFrames: input.inspectionFrames,
    expectedMinimumLayers: layerCount,
    label: input.scenePath ? path.basename(input.scenePath) : 'active-scene',
    signal: input.signal,
  }, input.segmentFrames);
  return { ...result, scenePath: input.scenePath ?? null, compId: String(composition.compId) };
}
