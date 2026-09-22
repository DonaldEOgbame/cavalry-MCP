import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { operationRisk, safeAlternativeFor } from '../../src/bridge/watchdog.js';
import { interpolatePath } from '../../src/cavalry/safe-operations.js';

describe('safe host operations', () => {
  it('classifies known Cavalry 2.7.2 crash routes before execution', () => {
    assert.equal(operationRisk('path_morph'), 'HOST_UNSTABLE');
    assert.equal(operationRisk('timeline_play'), 'HOST_UNSTABLE');
    assert.equal(operationRisk('render_start'), 'CAUTION');
    assert.equal(operationRisk('attribute_get'), 'SAFE');
    assert.deepEqual(safeAlternativeFor('path_morph'), ['path_morph_safe', 'path_animation_safe']);
  });

  it('interpolates compatible editable-path topology', () => {
    const from = [{ isClosed: true, points: [{ position: { x: 0, y: 10 }, selected: false }] }];
    const to = [{ isClosed: true, points: [{ position: { x: 20, y: 30 }, selected: false }] }];
    const middle: any = interpolatePath(from, to, 0.5);
    assert.deepEqual(middle[0].points[0].position, { x: 10, y: 20 });
    assert.equal(middle[0].isClosed, true);
  });

  it('rejects incompatible path topology instead of producing a corrupt morph', () => {
    assert.throws(() => interpolatePath(
      [{ points: [{ position: { x: 0, y: 0 } }] }],
      [{ points: [{ position: { x: 1, y: 1 } }, { position: { x: 2, y: 2 } }] }],
      0.5,
    ), /topology mismatch/i);
  });
});
