import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeSceneDiff } from '../../src/cavalry/scene.js';

describe('computeSceneDiff', () => {
  it('identifies added and removed layers between snapshots', () => {
    const before = JSON.stringify({
      layers: [
        { uuid: 'uuid-1', id: 'basicShape#1', name: 'Rectangle' },
        { uuid: 'uuid-2', id: 'basicShape#2', name: 'Circle' },
      ],
    });

    const after = JSON.stringify({
      layers: [
        { uuid: 'uuid-1', id: 'basicShape#1', name: 'Rectangle' },
        { uuid: 'uuid-3', id: 'textShape#1', name: 'Headline' },
      ],
    });

    const diff = computeSceneDiff(before, after);
    assert.deepEqual(diff.addedLayers, ['uuid-3']);
    assert.deepEqual(diff.removedLayers, ['uuid-2']);
    assert.ok(diff.rawDiffSummary.includes('+ 1 added layer'));
    assert.ok(diff.rawDiffSummary.includes('- 1 removed layer'));
  });

  it('identifies modified layers regardless of object key order', () => {
    const before = JSON.stringify({ layers: [{ uuid: 'same', name: 'Old', position: { x: 1, y: 2 } }] });
    const after = JSON.stringify({ layers: [{ position: { y: 2, x: 1 }, name: 'New', uuid: 'same' }] });

    const result = computeSceneDiff(before, after);

    assert.deepEqual(result.modifiedLayers, ['same']);
    assert.match(result.rawDiffSummary, /modified/);
  });
});
