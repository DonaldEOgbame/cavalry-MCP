export type FrameClassification = 'content' | 'uniform-dark' | 'uniform-light' | 'unknown';

export function classifyFrameSamples(luminance: number[]): FrameClassification {
  if (!luminance.length) return 'unknown';
  if (luminance.every((value) => value <= 1)) return 'uniform-dark';
  if (luminance.every((value) => value >= 254)) return 'uniform-light';
  return 'content';
}

export interface MediaExpectation {
  video?: boolean;
  audio?: boolean;
  alpha?: boolean;
  codec?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  durationToleranceSeconds?: number;
}

export function validateMediaMetadata(metadata: any, expectation: MediaExpectation = {}): {
  valid: boolean;
  videoStreams: number;
  audioStreams: number;
  alpha: boolean;
  errors: string[];
} {
  const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
  const video = streams.filter((stream: any) => stream.codec_type === 'video');
  const audio = streams.filter((stream: any) => stream.codec_type === 'audio');
  const alpha = video.some((stream: any) => /(?:a|yuva|rgba|argb)/i.test(String(stream.pix_fmt ?? '')));
  const errors: string[] = [];
  if (video.some((stream: any) => !Number(stream.width) || !Number(stream.height))) errors.push('video_dimensions_missing');
  if (expectation.video === true && !video.length) errors.push('video_stream_missing');
  if (expectation.audio === true && !audio.length) errors.push('audio_stream_missing');
  if (expectation.alpha === true && !alpha) errors.push('alpha_channel_missing');
  if (expectation.codec && !video.some((stream: any) => String(stream.codec_name ?? '').toLowerCase() === expectation.codec!.toLowerCase())) errors.push('video_codec_mismatch');
  if (expectation.width && !video.some((stream: any) => Number(stream.width) === expectation.width)) errors.push('video_width_mismatch');
  if (expectation.height && !video.some((stream: any) => Number(stream.height) === expectation.height)) errors.push('video_height_mismatch');
  if (expectation.durationSeconds !== undefined) {
    const actual = Number(metadata?.format?.duration);
    const tolerance = expectation.durationToleranceSeconds ?? 0.25;
    if (!Number.isFinite(actual) || Math.abs(actual - expectation.durationSeconds) > tolerance) errors.push('media_duration_mismatch');
  }
  return { valid: errors.length === 0, videoStreams: video.length, audioStreams: audio.length, alpha, errors };
}
