/**
 * The 104-second production workload shared by the benchmark and the
 * end-to-end acceptance run: 55 scenes, 3,120 frames, all 16 primitives.
 */
export const primitives = [
  'enterUp', 'enterDown', 'enterLeft', 'enterRight', 'wordSwap', 'verticalRoll',
  'progressiveBuild', 'textReflow', 'pushTransition', 'scaleTakeover', 'scaleTransfer',
  'zoomThrough', 'maskedReveal', 'trackingExpansion', 'colorSnap', 'hardCut',
];

export const productionProject = {
  id: 'external-production-benchmark',
  name: 'External MCP Production Benchmark',
  resolution: { width: 1920, height: 1080 },
  fps: 30,
  designTokens: { colors: { light: '#f5f1e8', dark: '#111827', red: '#ef4444', blue: '#2563eb' } },
  typographyStyles: {
    headline: { fontFamily: 'Helvetica', fontStyle: 'Bold', fontSize: 112, color: '#ffffff', alignment: 'center' },
    expressive: { fontFamily: 'Georgia', fontStyle: 'Regular', fontSize: 128, color: '#ffffff', alignment: 'center', tracking: 2 },
  },
  globalTiming: { defaultTransitionFrames: 16, sceneGapFrames: 0 },
  scenes: Array.from({ length: 55 }, (_, index) => ({
    id: `scene-${String(index + 1).padStart(2, '0')}`,
    name: `Typography Beat ${index + 1}`,
    durationFrames: index === 54 ? 42 : 57,
    background: ['light', 'dark', 'red', 'blue'][index % 4],
    elements: [
      {
        id: 'headline', kind: 'text', text: `MOTION BEAT ${index + 1}`, style: 'headline', position: { x: 0, y: index % 2 ? -40 : 0 },
        motions: [
          { type: primitives[index % primitives.length], durationFrames: 15 },
          { type: primitives[(index + 5) % primitives.length], startFrame: 16, durationFrames: 13 },
          { type: primitives[(index + 7) % primitives.length], startFrame: 29, durationFrames: 11 },
          { type: primitives[(index + 11) % primitives.length], startFrame: 40, durationFrames: 9 },
          { type: primitives[(index + 14) % primitives.length], startFrame: 48, durationFrames: 8 },
        ],
      },
      ...(index % 2 === 0 ? [{
        id: 'accent', kind: 'text', text: `Expressive ${index + 1}`, style: 'expressive', position: { x: 0, y: 95 },
        motions: [
          { type: primitives[(index + 2) % primitives.length], durationFrames: 14 },
          { type: primitives[(index + 9) % primitives.length], startFrame: 20, durationFrames: 12 },
          { type: primitives[(index + 4) % primitives.length], startFrame: 34, durationFrames: 10 },
          { type: primitives[(index + 13) % primitives.length], startFrame: 44, durationFrames: 8 },
        ],
      }] : []),
    ],
  })),
};
