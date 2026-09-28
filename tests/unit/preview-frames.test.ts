import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREVIEW_FRAME_TIMEOUT_MS } from '../../src/preview/frames.js';

describe('preview frame deadlines', () => {
  it('allows a cold production scene longer than the generic bridge timeout', () => {
    assert.equal(PREVIEW_FRAME_TIMEOUT_MS, 60_000);
    assert.ok(PREVIEW_FRAME_TIMEOUT_MS > 15_000);
  });
});
