import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeHostLog } from '../../scripts/lib/host-log.js';

test('host log summary counts both qualified and plain Attribute not found errors', () => {
  const summary = summarizeHostLog([
    '[08:52:21.030 error   ] Attribute not found: color',
    '[08:52:21.031 error   ] Attribute not found: animationCurve#447.uuid',
    '[08:52:21.032 error   ] Attribute not found: textShape#12.gradient.3.color',
  ].join('\n'));

  assert.equal(summary.attributeNotFound, 3);
  assert.deepEqual(summary.families, [
    { family: 'color', count: 1 },
    { family: 'animationCurve.uuid', count: 1 },
    { family: 'textShape.gradient.N.color', count: 1 },
  ]);
  assert.deepEqual(summary.firstNonAttributeErrors, []);
});
