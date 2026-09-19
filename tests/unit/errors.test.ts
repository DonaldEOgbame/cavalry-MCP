import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CavalryError } from '../../src/mcp/errors.js';

describe('CavalryError', () => {
  it('preserves structured error details', () => {
    const err = new CavalryError({
      code: 'LAYER_NOT_FOUND',
      message: 'Layer with ID "textShape#99" does not exist.',
      operation: 'layer_inspect',
      relevantIds: ['textShape#99'],
      suggestion: 'Check layer_list for active layer IDs.',
    });

    assert.equal(err.code, 'LAYER_NOT_FOUND');
    assert.equal(err.operation, 'layer_inspect');
    assert.deepEqual(err.relevantIds, ['textShape#99']);
    assert.equal(err.suggestion, 'Check layer_list for active layer IDs.');

    const json = err.toJSON();
    assert.equal(json.code, 'LAYER_NOT_FOUND');
  });

  it('maps connection refused to BRIDGE_OFFLINE', () => {
    const raw = new Error('connect ECONNREFUSED 127.0.0.1:8080');
    const mapped = CavalryError.fromUnknown(raw, 'cavalry_ping');
    assert.equal(mapped.code, 'BRIDGE_OFFLINE');
    assert.ok(mapped.suggestion?.includes('CavalryBridge'));
  });

  it('maps timeout to BRIDGE_TIMEOUT', () => {
    const raw = new Error('The operation was aborted due to timeout');
    const mapped = CavalryError.fromUnknown(raw, 'preview_frame');
    assert.equal(mapped.code, 'BRIDGE_TIMEOUT');
  });
});
