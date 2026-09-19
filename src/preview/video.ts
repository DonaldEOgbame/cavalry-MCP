import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { previewFrames } from './frames.js';
import { filesystem } from '../utils/filesystem.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export interface PreviewVideoResult {
  filePath?: string;
  sequenceDir?: string;
  frameCount: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  format: 'mp4' | 'sequence';
}

export async function previewVideo(
  startFrame: number,
  endFrame: number,
  fps: number = 30,
  scalePercentage: number = 50,
  customOutputPath?: string,
): Promise<PreviewVideoResult> {
  const frames: number[] = [];
  for (let f = startFrame; f <= endFrame; f++) {
    frames.push(f);
  }

  const previewDir = filesystem.getPreviewDir();
  const sequenceDir = path.join(previewDir, `seq_${Date.now()}`);
  fs.mkdirSync(sequenceDir, { recursive: true });

  logger.info(`Rendering ${frames.length} preview frames...`);
  const rendered = await previewFrames(frames, scalePercentage, sequenceDir);

  // Check if ffmpeg is available
  let ffmpegPath: string | null = null;
  try {
    const { stdout } = await execFileAsync('which', ['ffmpeg']);
    if (stdout.trim()) ffmpegPath = stdout.trim();
  } catch {}

  const videoOut = customOutputPath
    ? filesystem.assertAllowedPath(customOutputPath, 'previewVideo')
    : path.join(previewDir, `preview_${Date.now()}.mp4`);

  if (ffmpegPath && rendered.length > 0) {
    // Generate an ffmpeg concat demuxer file
    const concatListPath = path.join(sequenceDir, 'input.txt');
    const frameDuration = 1 / fps;
    const lines = rendered.map(r => `file '${r.filePath}'\nduration ${frameDuration}`);
    lines.push(`file '${rendered[rendered.length - 1].filePath}'`);
    fs.writeFileSync(concatListPath, lines.join('\n'), 'utf8');

    try {
      await execFileAsync(ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '28', // fast, low quality preview
        '-preset', 'ultrafast',
        videoOut,
      ]);

      return {
        filePath: videoOut,
        frameCount: frames.length,
        startFrame,
        endFrame,
        fps,
        format: 'mp4',
      };
    } catch (ffmpegErr) {
      logger.warn('FFmpeg encoding failed, returning image sequence instead', { data: ffmpegErr });
    }
  }

  // Fallback: return sequence directory
  return {
    sequenceDir,
    frameCount: frames.length,
    startFrame,
    endFrame,
    fps,
    format: 'sequence',
  };
}
