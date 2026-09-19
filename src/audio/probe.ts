import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { filesystem } from '../utils/filesystem.js';

const execFileAsync = promisify(execFile);

export interface AudioProbeResult {
  filePath: string;
  durationSeconds: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
}

export async function audioProbe(filePath: string): Promise<AudioProbeResult> {
  const safePath = filesystem.assertAllowedPath(filePath, 'audioProbe');

  // Try macOS native afinfo first
  try {
    const { stdout } = await execFileAsync('afinfo', [safePath]);
    const durationMatch = stdout.match(/estimated duration:\s*([\d.]+)\s*sec/i);
    const sampleRateMatch = stdout.match(/([\d.]+)\s*Hz/i);
    const channelsMatch = stdout.match(/(\d+)\s*ch/i);

    if (durationMatch) {
      return {
        filePath: safePath,
        durationSeconds: parseFloat(durationMatch[1]),
        sampleRate: sampleRateMatch ? parseFloat(sampleRateMatch[1]) : undefined,
        channels: channelsMatch ? parseInt(channelsMatch[1], 10) : undefined,
        format: 'afinfo',
      };
    }
  } catch {}

  // Fallback to ffprobe
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      safePath,
    ]);
    const parsed = JSON.parse(stdout);
    return {
      filePath: safePath,
      durationSeconds: parseFloat(parsed.format?.duration || '0'),
      format: parsed.format?.format_name,
    };
  } catch {}

  return {
    filePath: safePath,
    durationSeconds: 0,
    format: 'unknown',
  };
}
