import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { filesystem } from '../utils/filesystem.js';

const execFileAsync = promisify(execFile);

export async function renderMuxAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<Record<string, unknown>> {
  const safeVideo = filesystem.assertAllowedPath(videoPath, 'render_mux_audio');
  const safeAudio = filesystem.assertAllowedPath(audioPath, 'render_mux_audio');
  const safeOutput = filesystem.assertAllowedPath(outputPath, 'render_mux_audio');
  await Promise.all([access(safeVideo), access(safeAudio)]);

  await execFileAsync('ffmpeg', [
    '-y', '-i', safeVideo, '-i', safeAudio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', safeOutput,
  ], { maxBuffer: 10 * 1024 * 1024 });

  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,size:stream=index,codec_type,codec_name',
    '-of', 'json', safeOutput,
  ]);
  const probe = JSON.parse(stdout);
  const streams = probe.streams ?? [];
  if (!streams.some((stream: any) => stream.codec_type === 'video')) throw new Error('Mux verification found no video stream.');
  if (!streams.some((stream: any) => stream.codec_type === 'audio')) throw new Error('Mux verification found no audio stream.');
  return { outputPath: safeOutput, verified: true, probe };
}
