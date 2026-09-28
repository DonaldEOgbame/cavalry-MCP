import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFrameSamples, validateMediaMetadata } from '../../src/cavalry/render-validation.js';

describe('render media validation', () => {
  it('distinguishes intentional uniform frames from decoded content without declaring them corrupt', () => {
    assert.equal(classifyFrameSamples([0, 0, 0]), 'uniform-dark');
    assert.equal(classifyFrameSamples([255, 255, 255]), 'uniform-light');
    assert.equal(classifyFrameSamples([20, 128, 240]), 'content');
    assert.equal(classifyFrameSamples([]), 'unknown');
  });

  it('validates PNG/video, alpha, audio-only, and muxed stream layouts independently', () => {
    assert.equal(validateMediaMetadata({ streams: [{ codec_type: 'video', codec_name: 'png', width: 1920, height: 1080, pix_fmt: 'rgba' }] }, { video: true, alpha: true }).valid, true);
    assert.equal(validateMediaMetadata({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, pix_fmt: 'yuv420p' }] }, { video: true }).valid, true);
    assert.equal(validateMediaMetadata({ streams: [{ codec_type: 'video', codec_name: 'prores', width: 1920, height: 1080, pix_fmt: 'yuva444p10le' }] }, { video: true, alpha: true }).valid, true);
    assert.equal(validateMediaMetadata({ streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080, pix_fmt: 'yuv420p10le' }] }, { video: true }).valid, true);
    assert.equal(validateMediaMetadata({ streams: [{ codec_type: 'audio', codec_name: 'aac', channels: 2 }] }, { audio: true }).valid, true);
    assert.equal(validateMediaMetadata({ streams: [{ codec_type: 'video', width: 320, height: 180 }, { codec_type: 'audio', channels: 2 }] }, { video: true, audio: true }).valid, true);
    assert.deepEqual(validateMediaMetadata({ streams: [{ codec_type: 'video', width: 0, height: 0 }] }, { video: true }).errors, ['video_dimensions_missing']);
  });

  it('rejects a fresh file with the wrong codec, dimensions, or duration', () => {
    const metadata = {
      streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1280, height: 720, pix_fmt: 'yuv420p' }],
      format: { duration: '9.0' },
    };
    assert.deepEqual(validateMediaMetadata(metadata, {
      video: true, codec: 'h264', width: 1920, height: 1080, durationSeconds: 10, durationToleranceSeconds: 0.1,
    }).errors, ['video_codec_mismatch', 'video_width_mismatch', 'video_height_mismatch', 'media_duration_mismatch']);
  });
});
