#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { productionProject } from './fixtures/production-project.js';
import { closeHostLogWindow, counterDelta, openHostLogWindow } from './lib/host-log.js';

const live = process.argv.includes('--live');
const render = process.argv.includes('--render');
const resumeRender = process.argv.includes('--resume-render');
// Invalid attribute probing fails a live run unless explicitly recording a baseline.
const allowInvalidProbing = process.argv.includes('--allow-invalid-probing');
const logFlag = process.argv.indexOf('--cavalry-log');
const cavalryLogPath = logFlag !== -1 ? process.argv[logFlag + 1] : process.env.CAVALRY_LOG_PATH;
const project = productionProject;

const client = new Client({ name: 'cavalry-motion-black-box-benchmark', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.resolve('dist/index.js')],
  cwd: process.cwd(),
  env: { ...process.env, CAVALRY_TOOL_PROFILE: 'core', CAVALRY_ALLOW_RAW_SCRIPT: 'false' } as Record<string, string>,
  stderr: 'pipe',
  maxBufferSize: 50 * 1024 * 1024,
});
// Drain server diagnostics so a large verified compile cannot fill the child
// stderr pipe and turn logging back-pressure into a false performance result.
transport.stderr?.on('data', () => {});

let mcpCalls = 0;
const timings: Record<string, number> = {};
const transcript: Array<{ tool: string; durationMs: number; imageCount: number }> = [];

function parse(result: any) {
  const text = result.content?.find((item: any) => item.type === 'text')?.text;
  const payload = text ? JSON.parse(text) : null;
  if (result.isError || payload?.ok === false) throw new Error(`MCP tool failed: ${text ?? 'unknown error'}`);
  return { payload: payload?.result ?? payload, imageCount: result.content?.filter((item: any) => item.type === 'image').length ?? 0 };
}

async function call(tool: string, args: Record<string, unknown>) {
  assert.notEqual(tool, 'cavalry_raw_script', 'Raw scripts are prohibited in the benchmark.');
  const started = performance.now();
  const result = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: render ? 60 * 60 * 1000 : 10 * 60 * 1000 });
  const durationMs = performance.now() - started;
  mcpCalls += 1;
  const parsed = parse(result);
  transcript.push({ tool, durationMs: Number(durationMs.toFixed(2)), imageCount: parsed.imageCount });
  return parsed;
}

const totalStarted = performance.now();
try {
  const connectStarted = performance.now();
  await client.connect(transport);
  timings.connectMs = performance.now() - connectStarted;

  const listStarted = performance.now();
  const listed = await client.listTools();
  timings.toolsListMs = performance.now() - listStarted;
  const names = new Set(listed.tools.map((tool) => tool.name));
  for (const required of ['motion_project_create', 'motion_project_compile', 'motion_project_verify', 'motion_project_render_review', 'motion_project_apply_corrections']) assert.ok(names.has(required), `Missing production tool ${required}`);
  assert.equal(names.has('cavalry_raw_script'), false, 'Production profile must not expose raw scripting.');

  // Host-hygiene window: bridge attribute counters and (optionally) the
  // Cavalry log, from before the first project call to after the last.
  const hostLog = live ? openHostLogWindow(cavalryLogPath) : null;
  const healthBefore = live ? await call('cavalry_health', {}) : null;

  const create = await call('motion_project_create', { project });
  assert.equal(create.payload.sceneCount, 55);
  assert.equal(create.payload.durationFrames, 3120);
  assert.ok(create.payload.expectedLayers >= 100 && create.payload.expectedLayers <= 150);
  assert.ok(create.payload.expectedKeyframes >= 2000);

  if (resumeRender) {
    const attached = await call('motion_project_attach_current', { projectId: project.id });
    assert.equal(attached.payload.attached, true);
  } else {
    const compileStarted = performance.now();
    const compiled = await call('motion_project_compile', { projectId: project.id, force: live, dryRun: !live });
    timings.compileMs = performance.now() - compileStarted;
    assert.ok(compiled.payload.operationCount > 100, 'Compiler must execute substantial optimized bridge work.');
  }

  if (live && !resumeRender) {
    const verifyStarted = performance.now();
    const verified = await call('motion_project_verify', { projectId: project.id, detailed: false });
    timings.verifyMs = performance.now() - verifyStarted;
    assert.equal(verified.payload.valid, true);

    const qcStarted = performance.now();
    const review = await call('motion_project_render_review', { projectId: project.id, frames: Array.from({ length: 12 }, (_, index) => Math.min(3119, index * 280 + 28)), scalePercentage: 15 });
    timings.qcMs = performance.now() - qcStarted;
    assert.equal(review.imageCount, 12, 'QC must return MCP image blocks, not paths alone.');
  }

  if (!resumeRender) {
    const correctionStarted = performance.now();
    await call('motion_project_apply_corrections', {
      projectId: project.id,
      corrections: [{ sceneId: 'scene-27', elementId: 'headline', issue: 'Tracking is too tight', desiredCorrection: 'Open tracking for readability', properties: { tracking: 4 } }],
      dryRun: !live,
    });
    timings.correctionMs = performance.now() - correctionStarted;
  }

  if (live && render) {
    const outputDirectory = path.join(os.tmpdir(), 'cavalry-motion-benchmark');
    await fs.mkdir(outputDirectory, { recursive: true });
    await call('scene_save_as', { filePath: path.join(outputDirectory, `production-${process.pid}.cv`) });
    const renderStarted = performance.now();
    const submitted = await call('motion_project_render', {
      projectId: project.id,
      outputDirectory,
      fileName: `production-${process.pid}`,
      background: false,
      waitForCompletion: true,
      pollIntervalMs: 2_000,
      strictVisualValidation: true,
    });
    assert.equal(submitted.payload.finalStatus?.state, 'COMPLETED');
    timings.renderMs = performance.now() - renderStarted;
  }

  const healthAfter = live ? await call('cavalry_health', {}) : null;
  const hostLogSummary = closeHostLogWindow(hostLog);
  const attributeDelta = counterDelta(healthBefore?.payload?.attributeHygiene, healthAfter?.payload?.attributeHygiene);
  const hostHygiene = live ? {
    bridgeReportsAttributeMetrics: Boolean(healthAfter?.payload?.attributeHygiene),
    attributeMetricsDelta: attributeDelta,
    invalidAttributeReads: attributeDelta?.invalidAttributeReads ?? null,
    capabilityCache: healthAfter?.payload?.capabilityCache ?? null,
    incidentsByCategory: healthAfter?.payload?.incidents?.byCategory ?? null,
    dialogClassOccurrences: healthAfter?.payload?.incidents?.dialogClassOccurrences ?? null,
    cavalryLog: hostLogSummary ?? { captured: false, reason: 'Pass --cavalry-log <path> or set CAVALRY_LOG_PATH to capture the host log window.' },
  } : null;

  const metrics = await call('motion_project_metrics', { projectId: project.id });
  const totalMs = performance.now() - totalStarted;
  const report = {
    mode: resumeRender ? 'external-live-render-resume' : live ? (render ? 'external-live-render' : 'external-live') : 'external-dry-run',
    transport: 'stdio-json-rpc',
    toolProfile: 'core',
    discoveredTools: listed.tools.length,
    mcpCalls,
    rawScriptCalls: 0,
    directBridgeCalls: 0,
    project: { scenes: 55, durationFrames: 3120, expectedLayers: create.payload.expectedLayers, expectedKeyframes: create.payload.expectedKeyframes, compiledOperations: create.payload.compiledOperationCount },
    timings: Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, Number(value.toFixed(2))])),
    totalMs: Number(totalMs.toFixed(2)),
    serverTelemetry: metrics.payload,
    hostHygiene,
    transcript,
  };
  await fs.mkdir(path.resolve('coverage'), { recursive: true });
  await fs.writeFile(path.resolve('coverage', `motion-compiler-benchmark-${report.mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (hostHygiene && !allowInvalidProbing) {
    assert.ok(hostHygiene.bridgeReportsAttributeMetrics, 'The installed bridge does not report attribute metrics; reinstall cavalry/bridge.js from this checkout.');
    assert.equal(hostHygiene.invalidAttributeReads, 0, 'The bridge issued attribute reads that Cavalry rejected.');
    if (hostLogSummary) assert.equal(hostLogSummary.attributeNotFound, 0, `Cavalry logged ${hostLogSummary.attributeNotFound} "Attribute not found" errors during the run.`);
  }
} finally {
  await transport.close();
}
