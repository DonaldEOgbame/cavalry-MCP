import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_SCENE_ACTIVATION_TIMEOUT_MS, visualTolerance } from '../../src/render/service.js';

describe('render service boundaries', () => {
  it('allows a large reopened scene longer than the generic bridge timeout to activate', () => {
    assert.equal(RENDER_SCENE_ACTIVATION_TIMEOUT_MS, 60_000);
    assert.ok(RENDER_SCENE_ACTIVATION_TIMEOUT_MS > 15_000);
  });

  it('requires an explicit opt-in before accepting uniform sampled frames', () => {
    assert.deepEqual(visualTolerance({ strictVisualValidation: true }, 8), { allowBlankFrames: 0, allowStaticContent: false });
    assert.deepEqual(visualTolerance({ strictVisualValidation: true, allowUniformFrames: true }, 8), { allowBlankFrames: 8, allowStaticContent: true });
  });
});
