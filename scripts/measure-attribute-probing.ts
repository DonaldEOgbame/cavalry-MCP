#!/usr/bin/env node
/**
 * Model-based before/after measurement of invalid attribute probing.
 *
 * Replays the 55-scene production compile/verify/correct workload through a
 * bridge.js revision running against the behavioural host model in
 * tests/bridge/support/cavalry-model.ts, and counts the "Attribute not found"
 * lines that model logs. These are MODEL counts: they show which bridge code
 * paths issue invalid reads, not how many lines the live Cavalry log contains.
 *
 *   tsx scripts/measure-attribute-probing.ts [--baseline <git-ref>] [--json <path>]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createBridgeSandbox } from '../tests/bridge/support/bridge-sandbox.js';
import { createCavalryModel } from '../tests/bridge/support/cavalry-model.js';
import { runProductionWorkload } from '../tests/bridge/support/production-workload.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export function measure(source: string, options: { subscribeEvents?: boolean } = {}) {
  const model = createCavalryModel();
  const sandbox = createBridgeSandbox({}, { source, host: model });
  const started = performance.now();
  try {
    const workload = runProductionWorkload(sandbox, options);
    const status = sandbox.send('bridge_status', {});
    return {
      attributeNotFound: model.log.attributeNotFound,
      topFamilies: [...model.log.byFamily.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([family, count]) => ({ family, count })),
      bridgeAttributeMetrics: status?.ok ? status.result.attributes ?? null : null,
      workload,
      wallMs: Number((performance.now() - started).toFixed(1)),
    };
  } finally {
    sandbox.cleanup();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const baselineRef = argument('--baseline') ?? 'HEAD';
  const baselineSource = execFileSync('git', ['show', `${baselineRef}:cavalry/bridge.js`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const currentSource = fs.readFileSync('cavalry/bridge.js', 'utf8');
  const report = {
    kind: 'attribute-probing-model',
    note: 'Counts from the behavioural host model, not a live Cavalry log.',
    baselineRef,
    before: measure(baselineSource),
    after: measure(currentSource),
    afterWithEventSubscription: measure(currentSource, { subscribeEvents: true }),
  };
  const output = argument('--json');
  if (output) fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
