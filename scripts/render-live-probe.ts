#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { argument, McpHarness, stamp, writeEvidence } from './lib/mcp-harness.js';

const scenePath = argument('--scene');
if (!scenePath) throw new Error('Missing --scene <file.cv>');
const outputDirectory = path.resolve(argument('--output-dir', path.join(os.tmpdir(), 'cavalry-mcp-phase3', 'renders'))!);
const fileName = argument('--file-name', `probe-${stamp()}`)!;
const evidenceDirectory = path.resolve(argument('--evidence', path.join(outputDirectory, '.probe-evidence', fileName))!);
const numberArg = (name: string): number | undefined => {
  const value = argument(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be numeric`);
  return parsed;
};

fs.mkdirSync(outputDirectory, { recursive: true });
const harness = await McpHarness.start({
  evidenceDirectory,
  profile: 'standard',
  clientName: 'cavalry-render-live-probe',
  env: { CAVALRY_WATCHDOG_AUTO_RESTART: 'true' },
});
const controller = new AbortController();
const abortAfterMs = numberArg('--abort-after-ms');
const abortTimer = abortAfterMs ? setTimeout(() => controller.abort(), abortAfterMs) : undefined;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const args: Record<string, unknown> = {
    scenePath: path.resolve(scenePath),
    outputDirectory,
    fileName,
    maxAttempts: numberArg('--max-attempts') ?? 1,
    inspectionFrames: numberArg('--inspection-frames') ?? 0,
    strictVisualValidation: argument('--allow-uniform') === undefined,
    allowUniformFrames: argument('--allow-uniform') !== undefined,
  };
  for (const [flag, key] of [['--start', 'startFrame'], ['--end', 'endFrame'], ['--segment-frames', 'segmentFrames']] as const) {
    const value = numberArg(flag);
    if (value !== undefined) args[key] = value;
  }
  const render = await harness.call('render_scene_verified', args, { signal: controller.signal, timeoutMs: 60 * 60 * 1000 });
  let cancellation: Awaited<ReturnType<typeof harness.call>> | null = null;
  const postAbortHealth: Array<{ checkedAt: string; state?: string; ready?: boolean; ok: boolean }> = [];
  if (render.errorCode === 'CLIENT_ABORTED') {
    // Keep the stdio server alive after the SDK returns AbortError. The tool
    // handler still needs that process to cancel the native job, destroy its
    // disposable item, and run clean-host recovery when cancellation wedges
    // Cavalry. An immediate transport close would terminate that cleanup.
    cancellation = await harness.call('render_cancel', {}, { timeoutMs: 15_000 });
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const sample = await harness.call('cavalry_health', {}, { timeoutMs: 15_000 });
      const host = (sample.payload as any)?.host;
      postAbortHealth.push({ checkedAt: new Date().toISOString(), state: host?.state, ready: host?.ready, ok: sample.ok });
      if (sample.ok && host?.ready) break;
      await sleep(2_000);
    }
  }
  const health = await harness.call('cavalry_health');
  let report: unknown = null;
  const reportPath = (render.payload as any)?.reportPath ?? (render.error as any)?.diagnostics?.reportPath;
  if (typeof reportPath === 'string' && fs.existsSync(reportPath)) report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const summary = {
    kind: 'live-render-probe',
    generatedAt: new Date().toISOString(),
    request: args,
    abortAfterMs: abortAfterMs ?? null,
    cancellation: cancellation ? { ok: cancellation.ok, durationMs: cancellation.durationMs, errorCode: cancellation.errorCode, payload: cancellation.payload, error: cancellation.error } : null,
    postAbortHealth,
    render: {
      ok: render.ok,
      durationMs: render.durationMs,
      errorCode: render.errorCode,
      error: render.error,
      result: render.ok ? render.payload : null,
    },
    healthAfter: health.ok ? health.payload : { ok: false, error: health.error },
    report,
  };
  const summaryPath = writeEvidence(evidenceDirectory, 'summary.json', summary);
  process.stdout.write(`${JSON.stringify({ summaryPath, renderOk: render.ok, errorCode: render.errorCode, reportPath, hostState: (health.payload as any)?.host?.state }, null, 2)}\n`);
  if (!render.ok && render.errorCode !== 'CLIENT_ABORTED' && render.errorCode !== 'OPERATION_CANCELLED') process.exitCode = 1;
} finally {
  if (abortTimer) clearTimeout(abortTimer);
  await harness.close();
}
