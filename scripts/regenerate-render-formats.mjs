import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Merges live-render-format-sweep.ts results into coverage/render-formats.json,
// replacing the stale "BLOCKED" claim with actual per-format live evidence.
// Run scripts/live-render-format-sweep.ts first to produce
// coverage/render-format-sweep-results.json.

const sweepPath = resolve('coverage/render-format-sweep-results.json');
const outPath = resolve('coverage/render-formats.json');

const sweep = JSON.parse(await readFile(sweepPath, 'utf8'));
const existing = JSON.parse(await readFile(outPath, 'utf8'));

const byNodeType = new Map(sweep.results.map((r) => [r.nodeType, r]));

const formats = {};
for (const [label, entry] of Object.entries(existing.formats)) {
  const result = byNodeType.get(entry.nodeType);
  if (!result) {
    formats[label] = { ...entry, liveVerified: false, liveStatus: 'NOT_SWEPT' };
    continue;
  }
  formats[label] = {
    ...entry,
    liveVerified: result.status === 'PASS',
    liveStatus: result.status,
    liveEvidence: {
      sizeBytes: result.sizeBytes,
      durationMs: result.durationMs,
      container: result.ffprobe?.format || (result.lottie ? 'lottie-json' : result.svg ? 'svg-xml' : undefined),
      videoCodec: result.ffprobe?.streams?.find((s) => s.codec_type === 'video')?.codec_name,
      audioCodec: result.ffprobe?.streams?.find((s) => s.codec_type === 'audio')?.codec_name,
      width: result.ffprobe?.streams?.find((s) => s.codec_type === 'video')?.width ?? result.lottie?.w,
      height: result.ffprobe?.streams?.find((s) => s.codec_type === 'video')?.height ?? result.lottie?.h,
    },
    ...(result.reason ? { liveNotes: result.reason } : {}),
  };
}

const report = {
  ...existing,
  liveRenderValidation: `LIVE: ${sweep.passed}/${sweep.total} formats fully verified (rendered + ffprobe/format-specific validation passed), ${sweep.knownLimitation} classified as known Cavalry 2.7.2 platform limitations, ${sweep.failed} failed. Generated ${sweep.generatedAt} by scripts/live-render-format-sweep.ts. See docs/coverage.md for the HEVC/ProRes audio-export limitation writeup.`,
  liveSweepGeneratedAt: sweep.generatedAt,
  formats,
};

await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Updated ${outPath} with live results from ${sweep.generatedAt}`);
console.log(`${sweep.passed}/${sweep.total} PASS, ${sweep.knownLimitation} KNOWN_LIMITATION, ${sweep.failed} FAIL`);
