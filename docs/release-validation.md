# Cavalry MCP Release Validation

Current as of 28 September 2026.

## Automated validation

- TypeScript build: PASS.
- Unit and bridge contract suite: 73/73 PASS.
- Complete tool-registration contract: 403 unique runtime definitions with schemas and handlers; 59 are exposed by the default production profile.
- Full-profile stress: 50 alternating `core`/`full` initializations PASS; 40.95 MiB heap delta on Node 26.
- Startup benchmark: core 14.00 ms / 272 tools; full 3.48 ms / 385 tools; 1,701-record Knowledge Engine 84.97 ms (Node 26).
- Full-source coverage instrumentation: 72.28% lines across intended production modules (15% enforced floor).
- Actual npm tarball: PASS for contents, isolated local install, isolated global-prefix install, `npx`, and direct CLI startup without repository-local files.
- Knowledge schema v2 migration, corrupted-overlay quarantine, and packaged-seed SHA-256 verification: PASS.
- Documentation/runtime consistency and deterministic 403-tool inventory/contracts/types regeneration: PASS.
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
- External live compile/verify/QC/correction: PASS through six typed MCP calls. Compile 51,724.57 ms; verify 459.36 ms; 12-image MCP-native QC 9,790.14 ms; correction 86.18 ms; 62,414.04 ms total excluding final MP4.
- Internal execution: 421 optimized bridge operations in 12 batches (35.08 average batch size), compared with an estimated 2,984 legacy MCP calls. Grouped five-scene batches and one event flush per batch reduced compile time by 86% from the earlier 371,744.16 ms run.
- Full production H.264: OPEN. Validation caught and fixed a generator-order bug that silently reset the requested range to 0–250; the rejected file was valid 1920×1080 H.264 but only 250 frames/8.3 seconds. With the exact 0–3,119 range restored, Cavalry 2.7.2 leaves a zero-byte container and becomes idle. The 5–12 minute first-draft and 8–18 minute corrected-draft targets therefore remain unproven only at the full-render boundary.
- Segmented render fallback: IMPLEMENTED, NOT YET CLEAN-HOST VALIDATED. It renders verified ranges of at most 250 frames and concatenates them losslessly, but the first replay followed a cancelled long render and inherited a wedged Render Manager.
- Cavalry JavaScript errors: OPEN. Intermittent user-observed JavaScript Error dialogs are not yet captured as structured bridge events with stack, request ID, operation, scene revision, and deduplication, so their exact causes and frequency cannot yet be reported reliably.

See [motion-compiler.md](motion-compiler.md) for the architecture, tool layers,
DSL, exact benchmark boundary, and remaining work.

The certified Cavalry boundary is intentionally 2.7.2: it is both the minimum and latest supported release for this package version. Newer Cavalry releases are compatibility candidates until the self-hosted live workflow passes. Node 20/22/24/26 are enforced by the hosted CI matrix.

The temporary-prefix tarball test proves repository independence on this host. A genuinely separate macOS account and additional Cavalry binaries were not available locally; those are represented by repeatable CI/self-hosted gates rather than claimed as manually observed evidence.
