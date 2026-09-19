import path from 'node:path';
import { bridgeClient } from '../bridge/client.js';
import { filesystem } from '../utils/filesystem.js';

export interface PreviewFrameResult {
  filePath: string;
  frame: number;
  scalePercentage: number;
}

export async function previewFrame(frame?: number, scalePercentage: number = 100, customOutputPath?: string): Promise<PreviewFrameResult> {
  const previewDir = filesystem.getPreviewDir();
  const targetFrame = frame !== undefined ? frame : 0;
  const fileName = `preview_frame_${targetFrame}_${Date.now()}`;
  const requestedPath = customOutputPath ? filesystem.assertAllowedPath(customOutputPath, 'preview_frame') : path.join(previewDir, fileName);
  const targetPath = requestedPath.toLowerCase().endsWith('.png') ? requestedPath.slice(0, -4) : requestedPath;

  const res = await bridgeClient.send<any>('preview_frame', {
    filePath: targetPath,
    frame: targetFrame,
    scalePercentage,
  });

  return {
    filePath: res.result!.filePath,
    frame: res.result!.frame,
    scalePercentage,
  };
}

export async function previewFrames(frames: number[], scalePercentage: number = 50, outputDir?: string): Promise<PreviewFrameResult[]> {
  const dir = outputDir ? filesystem.assertAllowedPath(outputDir, 'preview_frames') : filesystem.getPreviewDir();
  const results: PreviewFrameResult[] = [];

  for (const f of frames) {
    const targetPath = path.join(dir, `frame_${f}_${Date.now()}`);
    const res = await bridgeClient.send<any>('preview_frame', {
      filePath: targetPath,
      frame: f,
      scalePercentage,
    });
    results.push({
      filePath: res.result!.filePath,
      frame: res.result!.frame,
      scalePercentage,
    });
  }

  return results;
}
