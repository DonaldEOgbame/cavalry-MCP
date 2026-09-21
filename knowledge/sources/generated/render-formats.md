# Cavalry 2.7.2 Render Formats

Live result: LIVE: 12/14 formats fully verified (rendered + ffprobe/format-specific validation passed), 2 classified as known Cavalry 2.7.2 platform limitations, 0 failed. Generated 2026-09-20T13:56:31.917Z by scripts/live-render-format-sweep.ts. See docs/coverage.md for the HEVC/ProRes audio-export limitation writeup..

## APNG

Node type: renderAPNG.
Live status: PASS.


## Audio Only

Node type: renderAudioOnly.
Live status: PASS.


## GIF

Node type: renderGIF.
Live status: PASS.


## JPEG

Node type: renderJPEG.
Live status: PASS.


## Lottie

Node type: renderLottie.
Live status: PASS.


## MP4

Node type: renderMP4.
Live status: PASS.


## PNG

Node type: renderPNG.
Live status: PASS.


## QuickTime

Node type: renderQuicktime.
Live status: PASS.


## SVG

Node type: renderSVG.
Live status: PASS.


## Sprite Sheet

Node type: renderSpriteSheet.
Live status: PASS.


## WebP

Node type: renderWebP.
Live status: PASS.


## WebM

Node type: renderWebM.
Live status: PASS.


## HEVC

Node type: renderHVEC.
Live status: KNOWN_LIMITATION.
This generator does not expose exportAudio at runtime in Cavalry 2.7.2, despite inheriting it from the renderFormatWithAudio schema supertype (confirmed via render_item_inspect: MP4/QuickTime/WebM correctly expose and honor generator.exportAudio; HEVC/ProRes generators do not list it among their live attributes at all).

## ProRes

Node type: renderProRes.
Live status: KNOWN_LIMITATION.
This generator does not expose exportAudio at runtime in Cavalry 2.7.2, despite inheriting it from the renderFormatWithAudio schema supertype (confirmed via render_item_inspect: MP4/QuickTime/WebM correctly expose and honor generator.exportAudio; HEVC/ProRes generators do not list it among their live attributes at all).

