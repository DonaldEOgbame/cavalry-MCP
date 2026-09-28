# Supported and Tested Compatibility

This document states the project's **measured validation boundary**. It is not a
claim that every Cavalry feature works on every Cavalry version, operating
system, or third-party setup.

## Tested configuration

The following results were refreshed on **27 September 2026**:

| Area | Verified result |
|---|---:|
| Cavalry | 2.7.2 |
| Host operating system | macOS |
| Registered MCP tools | 403 total / 59 default production profile |
| Callable Cavalry API names | 358 unique / 359 qualified |
| Concrete Cavalry node types | 436 |
| Node attributes | 3,168 |
| Capability groups | 62 |
| Installed render generators | 14 |
| Build/edit/save/reopen/render soak | 500/500 cycles passed |
| Verified real scenes | 75 |
| Knowledge Engine records | 1,701 total / 1,700 verified |
| Disposable live acceptance | 22/22 |
| Large-scene construction | 1,000 layers, 2,000 keyframes, verified rollback |
| Bridge crash/restart recovery | PASS |
| Auth/callback/response-path security sweep | PASS |
| Unclassified callable or node-schema routes (`UNKNOWN`) | 0 |

The original 385 low-level and operational tools are accounted for in the final
ledger: 320 `PASS`, 38 `KNOWN_HOST_LIMITATION`, and 27 `PLATFORM_LIMITATION`.
The runtime now adds 18 declarative motion-compiler tools, bringing the complete
registry to 403. Their schemas, registration, deterministic compilation, and
external stdio dry-run contract pass; live compile, structural verification,
MCP-native image QC, and correction pass on the benchmark workload. The
production-sized final H.264 render remains an open validation boundary. A conservative 376 tools
were directly invoked in live validation. The remaining nine are explicitly
classified host/API boundaries; none is merely untested. All 14 installed
render generators were exercised: 12 pass natively, while HEVC and ProRes
produce valid video without native audio. The verified final-render workflow
muxes audio into both formats and confirms both streams with `ffprobe`.

The generic introspection architecture remains intentional: the project does
not register one MCP tool per node type.

## Known limitations

- **Camera Guides and camera type mutation:** native Guide creation and
  `camera_set_type` are host-unstable. Verified `camera_sequence_create`,
  `camera_cut`, `camera_transition`, and fixed-type camera creation are the safe
  alternatives; they do not claim native Camera Guide parity.
- **Editable Path native animation:** native morph/keyframe/resync calls are
  host-unstable. `path_morph_safe` and `path_animation_safe` validate topology
  and persist bounded frame-sampled Editable Shape sequences instead.
- **Timeline playback:** shared-process native playback can block the bridge.
  `timeline_preview_playback`, explicit frame previews, and preview video are
  verified alternatives.
- **HEVC and ProRes native audio:** the generators omit audio attributes.
  `render_mux_audio` is verified against real Cavalry HEVC and ProRes renders.
- **Google Sheets:** inspection/replacement needs a reachable external sheet;
  no credentialed network fixture was available. Image sequence, Smart Folder,
  and dedicated audio fixtures now pass.
- **Editor-only UI:** generic preset/tag mutation, Cavalry native file dialogs,
  third-party custom UI, 2.5D enable/disable, Control Centre enumeration,
  reliable native render progress, and vision fallback remain explicit platform
  boundaries. Stable menu commands, shortcuts, preferences, active-tool
  selection, workspace listing, windows, and Focus Mode pass via the opt-in UI
  driver.
- **Other operating systems and versions:** Windows bridge installation is
  supported by the project, but certification evidence is from Cavalry 2.7.2 on
  macOS only. Cavalry 2.7.2 is therefore the sole certified host version for
  this package release; newer versions are candidates until the live workflow
  passes. The packed artifact was tested from isolated local/global prefixes
  and through `npx`, but a separate macOS account was not available.

These are known, classified boundaries—not `UNKNOWN` coverage gaps.

## Validation evidence

- [Release validation report](docs/release-validation-2026-09-22.md)
- [Coverage report](docs/coverage.md)
- [Callable-surface audit](coverage/cavalry-surface-audit.json)
- [Live MCP tool sweep](coverage/live-mcp-tool-sweep-results.json)
- [Final 385-tool ledger](coverage/final-tool-ledger.json)
- [Motion compiler architecture and benchmark](docs/motion-compiler.md)
- [500-cycle soak results](coverage/live-soak-results.json)
- [Compatibility results](coverage/live-compatibility-results.json)
- [Render-format results](coverage/render-formats.json)
- [HEVC/ProRes mux results](coverage/render-mux-results.json)
- [Watchdog recovery result](coverage/live-watchdog-recovery-results.json)
- [Knowledge coverage matrix](knowledge/generated/knowledge-coverage-matrix.json)

The original typed-operation release remains **release-ready for its measured
Cavalry 2.7.2/macOS boundary, with explicit platform limitations**. The new
production motion-compiler surface is not yet classified release-ready because
the complete 55-scene H.264 acceptance has not produced a valid output on this
host. This is not a claim of universal Cavalry parity or of a completed
production-speed render benchmark.
