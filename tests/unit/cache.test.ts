import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MetadataCache } from '../../src/utils/cache.js';

describe('MetadataCache', () => {
  it('stores and retrieves items within TTL', () => {
    const cache = new MetadataCache();
    cache.set('key1', { value: 42 }, 1000);
    assert.deepEqual(cache.get('key1'), { value: 42 });
    assert.equal(cache.has('key1'), true);
  });

  it('expires items after TTL elapsed', async () => {
    const cache = new MetadataCache();
    cache.set('quick', 'hello', 10);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(cache.get('quick'), undefined);
    assert.equal(cache.has('quick'), false);
  });

  it('invalidates entries by prefix', () => {
    const cache = new MetadataCache();
    cache.set('attr_shape1_pos', 10);
    cache.set('attr_shape1_rot', 20);
    cache.set('attr_shape2_pos', 30);

    cache.invalidatePrefix('attr_shape1');
    assert.equal(cache.has('attr_shape1_pos'), false);
    assert.equal(cache.has('attr_shape1_rot'), false);
    assert.equal(cache.has('attr_shape2_pos'), true);
  });
});
