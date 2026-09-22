#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(process.argv[2] || 'coverage/live-soak-results.json');
const report = JSON.parse(await readFile(path, 'utf8'));
const samples = (report.samples || [])
  .filter((sample) => sample.metrics && Number.isFinite(sample.metrics.rssKb))
  .map((sample) => ({ cycle: sample.cycle, rssKb: sample.metrics.rssKb, handles: sample.metrics.handles }));

function regression(points) {
  const count = points.length;
  const meanX = points.reduce((sum, point) => sum + point.cycle, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.rssKb, 0) / count;
  const covariance = points.reduce((sum, point) => sum + ((point.cycle - meanX) * (point.rssKb - meanY)), 0);
  const varianceX = points.reduce((sum, point) => sum + ((point.cycle - meanX) ** 2), 0);
  const slopeKbPerCycle = covariance / varianceX;
  const predicted = points.map(point => meanY + slopeKbPerCycle * (point.cycle - meanX));
  const total = points.reduce((sum, point) => sum + ((point.rssKb - meanY) ** 2), 0);
  const residual = points.reduce((sum, point, index) => sum + ((point.rssKb - predicted[index]) ** 2), 0);
  return { slopeKbPerCycle, rSquared: total === 0 ? 1 : 1 - (residual / total) };
}

if (samples.length >= 3) {
  const tailStart = Math.max(1, report.completedCycles - Math.max(100, Math.floor(report.completedCycles * 0.2)));
  const tail = samples.filter(sample => sample.cycle >= tailStart);
  const allFit = regression(samples);
  const tailFit = regression(tail);
  const tailValues = tail.map(sample => sample.rssKb);
  const linearLeakDetected = tailFit.slopeKbPerCycle > 128 && tailFit.rSquared >= 0.5;
  report.resources.memoryTrend = {
    classification: linearLeakDetected ? 'LINEAR_GROWTH_DETECTED' : 'NO_LINEAR_GROWTH_DETECTED',
    linearLeakDetected,
    method: 'least-squares RSS regression over all metric samples and the final 100-or-20%-cycle tail',
    allSamples: { count: samples.length, ...allFit },
    tail: {
      startCycle: tail[0].cycle,
      endCycle: tail.at(-1).cycle,
      count: tail.length,
      minRssKb: Math.min(...tailValues),
      maxRssKb: Math.max(...tailValues),
      ...tailFit,
    },
    threshold: { slopeKbPerCycle: 128, minimumRSquared: 0.5 },
    note: 'A positive start/end delta alone is not treated as a leak when the post-warm-up tail oscillates and lacks a strong positive linear fit.',
  };
}

await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.resources.memoryTrend ?? { classification: 'INSUFFICIENT_SAMPLES' }, null, 2)}\n`);
