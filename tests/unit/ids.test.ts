import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IdentityResolver, isUuid, isSymbolicRef } from '../../src/utils/ids.js';

describe('IdentityResolver', () => {
  it('correctly detects valid and invalid UUIDv4 strings', () => {
    assert.equal(isUuid('4c0b4352-89f5-4702-8618-fa0ce70498a5'), true);
    assert.equal(isUuid('textShape#1'), false);
    assert.equal(isUuid('not-a-uuid'), false);
  });

  it('detects symbolic references in batch', () => {
    assert.equal(isSymbolicRef('$headline'), true);
    assert.equal(isSymbolicRef('textShape#1'), false);
  });

  it('registers and resolves dual identities between UUID and layerId', () => {
    const resolver = new IdentityResolver();
    const layer = {
      layerId: 'textShape#1',
      uuid: '4c0b4352-89f5-4702-8618-fa0ce70498a5',
      name: 'Headline',
      type: 'textShape',
    };

    resolver.register(layer);

    assert.equal(resolver.resolveToLayerId(layer.uuid), 'textShape#1');
    assert.equal(resolver.resolveToLayerId('textShape#1'), 'textShape#1');
    assert.equal(resolver.resolveToUuid('textShape#1'), layer.uuid);

    const details = resolver.getDetails(layer.uuid);
    assert.deepEqual(details, layer);

    resolver.invalidate(layer.uuid);
    assert.equal(resolver.resolveToLayerId(layer.uuid), layer.uuid);
  });
});
