#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderMuxAudio } from '../src/cavalry/render-mux.js';

const sweep = JSON.parse(await readFile(resolve('coverage/render-format-sweep-results.json'), 'utf8'));
const audioPath = resolve('coverage/fixtures/test-tone-440hz-1s.wav');
const outputDir = resolve('coverage/render-mux-output');
await mkdir(outputDir, { recursive: true });

const cases = [
  { label: 'HEVC', output: resolve(outputDir, 'hevc-with-audio.mp4') },
  { label: 'ProRes', output: resolve(outputDir, 'prores-with-audio.mov') },
];
const results = [];
for (const item of cases) {
  const source = sweep.results.find((entry: any) => entry.label === item.label)?.filePath;
  if (!source) throw new Error(`No ${item.label} render output exists in the live format sweep.`);
  const verified = await renderMuxAudio(source, audioPath, item.output);
  results.push({ label: item.label, source, status: 'PASS', ...verified });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  cavalryVersion: '2.7.2',
  method: 'Cavalry video-only render plus FFmpeg audio mux; ffprobe must find both video and audio streams.',
  counts: { PASS: results.length },
  results,
};
await writeFile(resolve('coverage/render-mux-results.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
