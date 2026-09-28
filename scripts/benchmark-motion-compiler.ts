#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const live = process.argv.includes('--live');
const render = process.argv.includes('--render');
const resumeRender = process.argv.includes('--resume-render');
const primitives = [
  'enterUp', 'enterDown', 'enterLeft', 'enterRight', 'wordSwap', 'verticalRoll',
  'progressiveBuild', 'textReflow', 'pushTransition', 'scaleTakeover', 'scaleTransfer',
  'zoomThrough', 'maskedReveal', 'trackingExpansion', 'colorSnap', 'hardCut',
];

const project = {
  id: 'external-production-benchmark',
  name: 'External MCP Production Benchmark',
  resolution: { width: 1920, height: 1080 },
  fps: 30,
  designTokens: { colors: { light: '#f5f1e8', dark: '#111827', red: '#ef4444', blue: '#2563eb' } },
  typographyStyles: {
    headline: { fontFamily: 'Helvetica', fontStyle: 'Bold', fontSize: 112, color: '#ffffff', alignment: 'center' },
    expressive: { fontFamily: 'Georgia', fontStyle: 'Regular', fontSize: 128, color: '#ffffff', alignment: 'center', tracking: 2 },
  },
  globalTiming: { defaultTransitionFrames: 16, sceneGapFrames: 0 },
  scenes: Array.from({ length: 55 }, (_, index) => ({
    id: `scene-${String(index + 1).padStart(2, '0')}`,
    name: `Typography Beat ${index + 1}`,
    durationFrames: index === 54 ? 42 : 57,
    background: ['light', 'dark', 'red', 'blue'][index % 4],
    elements: [
      {
        id: 'headline', kind: 'text', text: `MOTION BEAT ${index + 1}`, style: 'headline', position: { x: 0, y: index % 2 ? -40 : 0 },
        motions: [
          { type: primitives[index % primitives.length], durationFrames: 15 },
          { type: primitives[(index + 5) % primitives.length], startFrame: 16, durationFrames: 13 },
          { type: primitives[(index + 7) % primitives.length], startFrame: 29, durationFrames: 11 },
          { type: primitives[(index + 11) % primitives.length], startFrame: 40, durationFrames: 9 },
          { type: primitives[(index + 14) % primitives.length], startFrame: 48, durationFrames: 8 },
        ],
      },
      ...(index % 2 === 0 ? [{
        id: 'accent', kind: 'text', text: `Expressive ${index + 1}`, style: 'expressive', position: { x: 0, y: 95 },
        motions: [
          { type: primitives[(index + 2) % primitives.length], durationFrames: 14 },
          { type: primitives[(index + 9) % primitives.length], startFrame: 20, durationFrames: 12 },
          { type: primitives[(index + 4) % primitives.length], startFrame: 34, durationFrames: 10 },
          { type: primitives[(index + 13) % primitives.length], startFrame: 44, durationFrames: 8 },
        ],
      }] : []),
    ],
  })),
};

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
    transcript,
  };
  await fs.mkdir(path.resolve('coverage'), { recursive: true });
  await fs.writeFile(path.resolve('coverage', `motion-compiler-benchmark-${report.mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await transport.close();
}
