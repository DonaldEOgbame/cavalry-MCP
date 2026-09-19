export function secondsToFrames(seconds: number, fps: number = 30): number {
  return Math.round(seconds * fps);
}

export function framesToSeconds(frames: number, fps: number = 30): number {
  return frames / fps;
}

export interface AudioCue {
  name: string;
  timeSeconds: number;
  frame: number;
}

export function generateAudioCues(timestamps: Array<{ name: string; seconds: number }>, fps: number = 30): AudioCue[] {
  return timestamps.map(t => ({
    name: t.name,
    timeSeconds: t.seconds,
    frame: secondsToFrames(t.seconds, fps),
  }));
}
