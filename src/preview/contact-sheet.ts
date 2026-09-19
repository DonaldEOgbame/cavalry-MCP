import fs from 'node:fs';
import path from 'node:path';
import { previewFrames } from './frames.js';
import { filesystem } from '../utils/filesystem.js';

export interface ContactSheetResult {
  sheetPath: string;
  frameCount: number;
  frames: number[];
  columns: number;
  rows: number;
}

export async function generateContactSheet(
  frames: number[],
  columns: number = 3,
  scalePercentage: number = 25,
  customOutputPath?: string,
): Promise<ContactSheetResult> {
  const renderedFrames = await previewFrames(frames, scalePercentage);
  const rows = Math.ceil(renderedFrames.length / columns);
  const cellWidth = 320;
  const cellHeight = 180;
  const headerHeight = 60;
  const padding = 20;

  const totalWidth = padding * 2 + columns * cellWidth + (columns - 1) * padding;
  const totalHeight = headerHeight + padding * 2 + rows * cellHeight + (rows - 1) * padding;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" style="background-color: #121316; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">\n`;
  svgContent += `  <text x="${padding}" y="36" fill="#f0f2f5" font-size="20" font-weight="600">Cavalry Scene Visual Evaluation - Contact Sheet</text>\n`;
  svgContent += `  <text x="${padding}" y="52" fill="#71767f" font-size="12">Frames: ${frames.join(', ')} | Scale: ${scalePercentage}% | Generated: ${new Date().toLocaleTimeString()}</text>\n`;

  for (let i = 0; i < renderedFrames.length; i++) {
    const rf = renderedFrames[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = padding + col * (cellWidth + padding);
    const y = headerHeight + padding + row * (cellHeight + padding);

    let base64Data = '';
    try {
      if (fs.existsSync(rf.filePath)) {
        base64Data = fs.readFileSync(rf.filePath).toString('base64');
      }
    } catch {}

    svgContent += `  <g transform="translate(${x}, ${y})">\n`;
    svgContent += `    <rect width="${cellWidth}" height="${cellHeight}" rx="6" fill="#1c1e22" stroke="#2e3238" stroke-width="1"/>\n`;
    if (base64Data) {
      svgContent += `    <image href="data:image/png;base64,${base64Data}" width="${cellWidth}" height="${cellHeight}" preserveAspectRatio="xMidYMid meet"/>\n`;
    }
    // Burned-in frame badge
    svgContent += `    <rect x="8" y="8" width="64" height="22" rx="4" fill="#000000" fill-opacity="0.75"/>\n`;
    svgContent += `    <text x="40" y="23" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">F: ${rf.frame}</text>\n`;
    svgContent += `  </g>\n`;
  }

  svgContent += `</svg>`;

  const outDir = filesystem.getPreviewDir();
  const sheetPath = customOutputPath
    ? filesystem.assertAllowedPath(customOutputPath, 'generateContactSheet')
    : path.join(outDir, `contact_sheet_${Date.now()}.svg`);

  fs.writeFileSync(sheetPath, svgContent, 'utf8');

  return {
    sheetPath,
    frameCount: frames.length,
    frames,
    columns,
    rows,
  };
}
