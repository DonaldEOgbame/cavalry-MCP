# Cavalry MCP Release Validation

Current as of 28 September 2026.

## Automated validation

- TypeScript build: PASS.
- Unit and bridge suite: 154 PASS, 0 FAIL on this macOS/Node 26 host. It includes the real `bridge.js` executed in a VM (re-entrancy, deadlines, incident capture, session audit, attribute hygiene), the render pipeline against a simulated host on a virtual clock (13 failure/recovery scenarios), and artifact validation against real ffmpeg-encoded H.264.
- Complete tool-registration contract: 404 unique runtime definitions with schemas and handlers; 60 are exposed by the default production profile. The only addition is `render_scene_verified`.
- Full-profile stress: 50 alternating `core`/`full` initializations PASS; 6.06 MiB heap delta on Node 22. The script previously asserted a stale 385-tool count and failed at the prior revision; it now reads the generated inventory.
- Startup benchmark: core 14.00 ms / 272 tools; full 3.48 ms / 385 tools; 1,701-record Knowledge Engine 84.97 ms (Node 26).
- Full-source coverage instrumentation: 72.28% lines across intended production modules (15% enforced floor).
- Actual npm tarball: PASS for contents, isolated local install, isolated global-prefix install, `npx`, and direct CLI startup without repository-local files.
- Knowledge schema v2 migration, corrupted-overlay quarantine, and packaged-seed SHA-256 verification: PASS.
- Documentation/runtime consistency and deterministic 404-tool inventory/contracts/types regeneration: PASS. `coverage/cavalry-surface-audit.json` was not regenerated (that needs the installed macOS Cavalry metadata); only its derived `mcpTools` count was updated to the inventory's 404.
- Production dependency audit: 0 known vulnerabilities.
- Bridge protocol v2 negotiation, graceful shutdown, request cancellation, concurrent-session isolation, and documented Cavalry API contract: PASS.

## Live Cavalry 2.7.2/macOS validation

- Fresh disposable-scene acceptance: 22/22 PASS.
- Restart/reconnect through `npm run bridge:launch`: PASS without manual script activation.
- `npm run doctor -- --require-live`: PASS for app, bridge auth/protocol, temp paths, seed integrity, 193 font families, FFmpeg/FFprobe, permissions, and Render Manager availability.
- Live bridge security: PASS for missing, invalid, stale, and replayed credentials; encoded/non-loopback callback attempts; traversal and symlink response paths.
- Font diagnostics: PASS across 193 loaded families, missing-family, missing-weight/style/PostScript-name, duplicate-family-count, and variable-style probes; runtime installation still correctly requires a Cavalry restart.
- Large-scene stress: 1,000 layers and 2,000 keyframes created in verified batches; forced partial-batch failure rolled back to the exact prior layer count and final keyframe readback matched 2,000.
- Live latency thresholds: PASS (ping 43.56 ms, create layer 30.27 ms, 10-mutation batch 73.89 ms, scene inspection 101.01 ms, save 39.95 ms, render submission 49.98 ms).
- Crash recovery: PASS; Cavalry was terminated, restarted, bridge health restored, checkpoint restored, and scene readback verified in 5.273 seconds.
- End-to-end production workflow: PASS; create, animate, save, reopen, modify, save, render, validate PNG signature/size, and verify changed pixels.

## Production motion-compiler benchmark

- External stdio dry run: PASS with 55 scenes, 3,120 frames, 138 layers, 2,095 keyframes, 2,864 compiler operations, four MCP calls, no raw script, and no direct bridge calls (358.77 ms total).
- External live compile/verify/QC/correction after attribute cleanup: PASS through typed MCP calls. Fresh-run compile 49,910.08 ms; verify 286.26 ms; 12-image MCP-native QC 7,628.29 ms; correction 126.64 ms; 58,425.45 ms total excluding final MP4. A second clean run measured 50,051.11 ms compile / 58,502.32 ms total and flushed 55 host-log lines with zero errors.
- Internal execution: 421 optimized bridge operations in 12 batches (35.08 average batch size), compared with an estimated 2,984 legacy MCP calls. Grouped five-scene batches and one event flush per batch reduced compile time by 86% from the earlier 371,744.16 ms run.
- Full production H.264: OPEN. Validation caught and fixed a generator-order bug that silently reset the requested range to 0–250; the rejected file was valid 1920×1080 H.264 but only 250 frames/8.3 seconds. With the exact 0–3,119 range restored, Cavalry 2.7.2 leaves a zero-byte container and becomes idle. The 5–12 minute first-draft and 8–18 minute corrected-draft targets therefore remain unproven only at the full-render boundary.
- Segmented render fallback: now opt-in (`segmentFrames`), NOT YET CLEAN-HOST VALIDATED. The first replay followed a cancelled long render and inherited a wedged Render Manager.
- Cavalry JavaScript errors: capture implemented (guarded callbacks, `onJSError`, stack, request/batch/render correlation, deduplication, JSONL journal). NOT YET EXERCISED LIVE. See [runtime-reliability.md](runtime-reliability.md).
- Supervised disposable rendering, host-state classification, clean-host recovery, and persisted compiler state: implemented and covered offline. NOT YET EXERCISED LIVE.

## Attribute hygiene (P0)

- Measured baseline at `bbd2ae0`: 55,403 appended lines, 55,366 error lines, and 55,365 complete `Attribute not found:` records plus one truncated trailing record. It was dominated by `animationCurve.uuid` (37,430), `textShape.out` (2,158), `textShape.time` (1,577), `basicShape.out` (1,485), `basicShape.time` (1,045), and `timeMarker.uuid` (990). The older 124,527/124,592 observation remains historical, not the controlled baseline window.
- Traced to the bridge's change-notification callbacks and uuid-assuming identity lookups; see [attribute-hygiene.md](attribute-hygiene.md). Fixed with a positive capability registry: one `api.get` call site, enforced by an offline contract test.
- Behavioural host model, same 55-scene compile/verify/correct workload: 14,612 model `Attribute not found` lines before, **0** after, and 0 with a `*` event subscription (`npm run hygiene:model`). These are model counts, not host counts.
- Live hygiene: PASS with all ordinary-layer UUID checks, zero bridge invalid reads, zero failed steps, and zero `Attribute not found` lines. The live host differed from the offline model in four ways: ordinary-layer UUID is readable but not enumerated/confirmed by `hasAttribute`; marker `.time` is not readable; marker `color` is unsupported; and `basicShape` child attributes vary by generator instance. The bridge now uses positive scene membership for UUID, marker APIs/state, and per-instance confirmation for targeted reads; the model and regression suite match those observations.
- Full production benchmark gate: PASS twice with 421 bridge operations / 12 batches, 12 QC images and an applied correction; `invalidAttributeReads` 0, host errors 0, `Attribute not found` 0, and dialog-class incidents 0. The fresh run peaked at 564,000 KiB RSS. Health was confirmed idle with 55 ms `host.probeMs`, 22 ms bridge-status latency and 71 ms whole-tool latency.
- Live acceptance after the fixes: 22/22 PASS. One extra benchmark on a long-lived process timed out a QC preview at 15 seconds after compilation; health returned confirmed idle immediately and a clean restart passed. No responsiveness improvement is claimed from the timing difference.

See [motion-compiler.md](motion-compiler.md) for the architecture, tool layers,
DSL, exact benchmark boundary, and remaining work.

The certified Cavalry boundary is intentionally 2.7.2: it is both the minimum and latest supported release for this package version. Newer Cavalry releases are compatibility candidates until the self-hosted live workflow passes. Node 20/22/24/26 are enforced by the hosted CI matrix.

The temporary-prefix tarball test proves repository independence on this host. A genuinely separate macOS account and additional Cavalry binaries were not available locally; those are represented by repeatable CI/self-hosted gates rather than claimed as manually observed evidence.
