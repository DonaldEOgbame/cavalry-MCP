# Cavalry MCP Release Validation — 2026-09-22

## Release classification

**Release candidate for the measured Cavalry 2.7.2/macOS boundary, with
explicit platform limitations.** This is evidence of maximum practical coverage
within that tested configuration, not a claim of universal Cavalry parity.

## Final inventory

| Metric | Result |
|---|---:|
| Runtime MCP tools | 385 |
| Callable Cavalry API names | 358 unique / 359 qualified |
| Concrete node types | 436 |
| Node attributes | 3,168 total / 2,992 concrete-node attributes |
| Capability groups | 62 |
| UNKNOWN | 0 |

API surface classification is 182 structured, 131 guarded raw-script, 27
context-only, 4 Script UI bridge, and 31 Script UI methods. Capability groups
are 42 structured, 5 generic attribute/graph, 5 UI Accessibility, 1 raw-script,
and 9 explicitly unsupported. Node routing remains 268 structured, 132 generic,
and 36 schema-internal/unavailable, with no unknown node.

The generic architecture remains intentional: node creation, attribute
inspection/mutation, generator selection, and graph connections cover the node
schema without one MCP tool per node type.

## Live tool validation

The consolidated ledger accounts for **385/385** registered tools: 320 `PASS`,
38 `KNOWN_HOST_LIMITATION`, 27 `PLATFORM_LIMITATION`, and zero missing or
unclassified. A conservative **376 tools were directly invoked**. The nine not
replayed are known host/API boundaries: 2.5D toggles, dependent Camera Guide
routes, guarded raw scripting, Control Centre enumeration, dynamic preview, and
3D enablement. They are classified rather than described as tested.

Dedicated fixtures now pass for numbered image sequences, Smart Folders, WAV
audio import/probe/add/offset/in-out/volume, and specialized asset inspection.
Google Sheets inspection/replacement returns `PLATFORM_LIMITATION` because no
credentialed reachable sheet fixture was available.

Persistence-tested tools: **22**. Artifact/render-supervision-tested tools:
**13**. The exact lists are in `coverage/final-tool-ledger.json`.

The final automated acceptance command passes **22/22** workflows. A prior run
reproduced Cavalry's delayed process exit after a long stateful sequence; the
opt-in watchdog restarted Cavalry, relaunched the bridge, and allowed the next
workflow to pass. An independent checkpoint → process termination → restart →
bridge health → checkpoint restore test also passes.

## Safe alternatives and UI coverage

Native Camera Guide creation, camera type mutation, Editable Path keyframing,
path resynchronisation/morphing, and shared-process timeline playback are
blocked from ordinary unsafe execution. Verified alternatives are:

- `camera_sequence_create`, `camera_cut`, and `camera_transition`
- `path_morph_safe` and `path_animation_safe`, with topology validation
- `timeline_preview_playback`, using deterministic rendered video
- `safe_host_operation` and `operation_risk_classify`

The optional macOS UI driver was exercised across all 37 UI tools: 12 stable
operations pass and 25 return precise platform/interactive limitations. Passing
coverage includes command search/execution, shortcut discovery/execution,
preference enumeration, active-tool set/readback, workspace listing, window
opening, and Focus Mode. Generic tags, generic presets, native file dialogs,
third-party custom UI, and unattended persistent layout mutations remain
limited.

## Rendering

All 14 installed generators were rerun live. Twelve pass natively. HEVC and
ProRes produce valid video but expose no native audio attribute in Cavalry
2.7.2. The user-facing workaround passes: Cavalry renders the codec video,
FFmpeg muxes a separately rendered audio stream, and `ffprobe` confirms both
streams for HEVC+AAC and ProRes+AAC outputs.

Render supervision reports known state for MCP-launched foreground renders. It
does not fabricate background-render percentages when Cavalry exposes none.

## Knowledge Engine

| Corpus type | Total | Verified |
|---|---:|---:|
| Official documentation | 1,184 | 1,184 |
| Official API | 375 | 375 |
| Real scenes | 75 | 75 |
| Verified scripts | 12 | 12 |
| Recipes | 12 | 12 |
| Components | 3 | 3 |
| Failure/workaround records | 26 | 25 |
| Approved visual outcomes | 14 | 14 |
| **All records** | **1,701** | **1,700** |

The one unverified failure record is deliberately retained as observed failure
memory, not promoted as a verified workaround. Duplicate rate is zero; no
provenance, metadata, parsing, or source-type gap is reported. The 75 verified
real scenes include 73 golden-corpus studies plus two previously ingested real
scenes. Each new golden study has an editable `.cv`, extracted inspection,
rendered preview, validation manifest, and verified ingestion.

Success retrieval has 101 verified construction/outcome records across real
scenes, verified scripts, and approved visual outcomes, in addition to the 12
recipes and 3 reusable components.

The knowledge-assisted project was rerun from blank scene through search, plan,
construction, multi-frame preview, visual correction, save/reopen, structural
ingestion, and final render. The fresh final MP4 passes `ffprobe` as H.264,
960×540, 30 fps, 3.0 seconds. HEVC and ProRes audio-mux outcomes are verified
separately against real live-render outputs.

## Soak and compatibility

- **500/500** build/edit/save/reopen/render cycles passed with zero failures.
- Latency: 326.172 ms mean, 302 ms p50, 408 ms p95, 2,355 ms maximum.
- RSS moved from 56,912 KB to 304,352 KB; file handles moved from 189 to 191;
  tracked temp-file growth was zero.
- Regression analysis reports `NO_LINEAR_GROWTH_DETECTED`: final 100-cycle RSS
  slope −14.53 KB/cycle with R² 0.00033.
- Fonts and missing-font detection pass.
- Latin, Arabic/RTL, Japanese, and emoji text persist and render.
- Unicode/RTL paths save and reopen.
- A 1,000-instance graph and 3,000-frame timeline persist.
- A 2,048px PNG reports `sRGB IEC61966-2.1` after clean-host recovery.

The ICC check reproduced an empty-profile result in a stressed long-lived host,
then passed after watchdog-style clean-host restart. Clean-clone setup, Windows,
and a second Cavalry release were not available and are not claimed.

## Automated checks

- TypeScript build: **PASS**
- Unit/bridge tests: **50/50 PASS**
- Live acceptance workflows: **22/22 PASS**
- Surface audit: **UNKNOWN 0**
- Node routes with `verifiedLive: false`: **0**
- Render formats: **12 native PASS / 2 native audio limitations / 2 muxed-audio PASS**
- Watchdog restart and checkpoint restore: **PASS**
- Knowledge audit and coverage matrix: **healthy**

## Remaining measured gaps

1. Native Camera Guides and post-creation camera-type mutation remain unsafe;
   semantic camera sequencing is not native Guide parity.
2. Native Editable Path keyframes/resync/morph remain unsafe; the sampled-layer
   alternative trades continuous native curves for bounded deterministic frames.
3. Native shared-process playback remains unsafe; rendered previews replace it.
4. HEVC/ProRes audio requires post-render muxing.
5. Google Sheets needs an external reachable fixture.
6. Generic presets, tags, native dialogs, third-party custom UI, vision fallback,
   2.5D toggles, Control Centre enumeration, and reliable native background
   progress remain platform/API limitations.
7. Certification is limited to Cavalry 2.7.2 on macOS; no claim is made for a
   clean clone, Windows runtime, or another Cavalry release.

## Evidence

- `coverage/final-tool-ledger.json`
- `coverage/cavalry-surface-audit.json`
- `coverage/live-specialized-fixture-results.json`
- `coverage/live-safe-fallback-results.json`
- `coverage/live-ui-driver-results.json`
- `coverage/live-watchdog-recovery-results.json`
- `coverage/render-format-sweep-results.json`
- `coverage/render-mux-results.json`
- `coverage/live-soak-results.json`
- `coverage/live-compatibility-results.json`
- `knowledge/generated/knowledge-coverage-matrix.json`
