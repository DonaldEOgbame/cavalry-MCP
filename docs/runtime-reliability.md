# Runtime Reliability

Current as of 28 September 2026. This covers the render-reliability P0 work.
The render path below is covered by offline tests and was exercised against
live Cavalry 2.7.2 after the [attribute-hygiene](attribute-hygiene.md) gate
reached zero invalid reads and zero `Attribute not found` host-log lines.
The Phase 3 live findings are recorded here; the repeated Phase 4 release
gates remain open until their dedicated harnesses complete.

## Cavalry JavaScript errors are captured and correlated

- Every bridge-owned native callback (WebServer `onPost`, the transport
  timer, and all application callbacks) is wrapped. An exception becomes a
  structured incident instead of escaping into Cavalry's script host, where
  it would raise a *JavaScript Error* dialog.
- `onJSError` records Cavalry-reported script errors.
- Each incident carries: error name, message and stack; the owning request
  (MCP request id, operation, batch id and step, age); correlation (`active`,
  `recent` within 5 s, or `none`); host state (scene revision, app state,
  active composition, frame, scene path, active render item/job/settings);
  and a diagnostic category. Repeats are deduplicated by fingerprint, with
  counts.
- Incidents ride back on normal responses (the client acknowledges a
  sequence number). The MCP server appends them to a JSONL journal
  (`CAVALRY_INCIDENT_LOG`, default `<data dir>/incidents/`) and attributes
  each one to the MCP tool call that issued the correlated request.
- `diagnostics_selftest_incident` (bridge operation) proves the capture path:
  a guarded one-shot timer throws and must appear as an incident.

## Host health distinguishes states

`cavalry_health` classifies the host as `idle`, `busy`, `rendering`,
`wedged`, `bridge_disconnected`, `error_dialog_active` or
`cavalry_not_running`, with `confidence` (`confirmed` or `inferred`), reasons,
`ready`, and `recoveryRecommended`. Signals:

- the process (`pgrep` / `tasklist`) and the transport (HTTP answer)
- `bridge_status`, a pure-JavaScript probe answered even while another
  operation owns the host
- an opt-in macOS Accessibility probe for a visible error dialog
  (`CAVALRY_DIALOG_PROBE=true` or `CAVALRY_UI_DRIVER=true`)
- the MCP server's in-flight requests and supervised renders (with output
  growth), and recent JavaScript errors

The response also includes the incident summary, transport statistics, and a
bridge session audit (requests per authenticated session, raw-script
requests), so a client that bypassed the MCP server shows up as a foreign
session.

Bridge hardening that supports this:

- **Re-entrancy guard.** Native calls such as `api.render()` and
  `api.processEvents()` can re-enter the post loop. Scene operations are now
  deferred until the outer operation returns. Only status probes (and
  `render_cancel`) run re-entrantly.
- **Request deadlines.** A request that waited past its client timeout is
  answered `REQUEST_EXPIRED` and never executed. This prevents "ghost"
  mutations after timeouts.
- **Render tracking.** `activeRender` / `lastRender` record how long
  `api.render()` actually blocked (`nativeCallMs`). This tells a blocking
  render apart from one that returns early and keeps encoding, which is
  evidence for the zero-byte investigation.

## Disposable, supervised rendering

`motion_project_render` and the one new tool, `render_scene_verified` (any
scene, independent of the compiler), share one pipeline:

1. **Preflight:** the host must be idle (brief wait if busy).
2. Purge Render Manager items left by earlier MCP jobs, identified by their
   `__mcp_<id>` staging names. User items are never touched.
3. **Checkpoint:** export a copy of the scene (`exportSceneAs`) without
   changing the current scene path. A motion-state sidecar is written next to
   it.
4. **Per attempt:** create a fresh item, select the generator first, then set
   and **read back** the range (catches the range-reset bug class), render to
   a private staging file, and supervise: output growth, stall windows, host
   loss (probed every 15 s), a lost response reconciled from the bridge's
   `lastRender`, and client cancellation.
5. **Validate the artifact** (never API success): file exists, non-empty,
   fresh, decodes, codec, resolution, fps, **exact frame count**, duration,
   and representative frames that are neither blank nor frozen. Then
   atomically rename the staging file to the requested name. A stale file
   with the final name is removed first, so it can't pass as new output.
6. **Always destroy the item.** An item that can't be deleted on a wedged
   host is discarded by recovery, because the checkpoint predates it.
7. **On failure:** clean-host recovery (terminate Cavalry, escalating TERM →
   KILL past modal dialogs; relaunch; reconnect or menu-activate the bridge;
   reopen the checkpoint; verify structure; confirm idle), then **retry
   exactly once**. Recovery requires macOS and
   `CAVALRY_WATCHDOG_AUTO_RESTART=true`. Otherwise only a healthy host is
   retried.
8. Renders are serialized. Every job writes a report to
   `<output>/.cavalry-mcp/reports/`. Validated frames can be returned as MCP
   images (`inspectionFrames`), so inspection sees the delivered file.

Full-range rendering is the default. Segmented rendering is an opt-in
fallback (`segmentFrames`). Unsupervised background renders are no longer
offered by `motion_project_render`. The low-level `render_start` now uses the
render timeout instead of the 15 s default, and missing ffprobe is now a
validation failure instead of a silent pass.

## Live Cavalry 2.7.2 render findings

The production scene has 55 scenes, 140 live layers after correction, a
0–3,119 inclusive range at 30 fps, and a 1,920×1,080 output. All measurements
below came from an external MCP client over stdio; the measurement harness did
not import the bridge client or use raw scripts.

The first full attempt exposed a real enum mismatch. The pipeline wrote
`frameRangeMode: 1`, Cavalry read the requested `frameRange` back as 0–3,119,
but the native renderer silently exported its default 0–250 range. Cavalry
2.7.2 uses mode **2** for a custom range, and the end value is inclusive. The
pipeline and low-level render configuration now write mode 2 and the exact end
frame rather than `end + 1`. A regression rejects the characteristic 250-frame
artifact.

With that fix, a fresh-launch, one-attempt full render passed:

- `api.render()` blocked for 207,159 ms, so Cavalry's call covers essentially
  the whole native export rather than returning immediately.
- The first output bytes appeared after 1,000 ms and the supervisor observed
  47 growth events. The complete tool call took 232,294 ms.
- The settings readback was `renderMP4`, mode 2, range 0–3,119.
- The 11,962,006-byte result decoded as H.264, 1,920×1,080, nominal 30 fps,
  3,120 frames and 103.966667 seconds. The host finished idle with zero
  incidents and zero invalid attribute reads.

Two validator assumptions also disagreed with live encoded media. FFprobe's
`avg_frame_rate` is duration-derived for these Cavalry files (including short
clips), while `r_frame_rate` is the encoded 30/1 cadence; validation now
prefers the latter. Fast input seeking can miss a sample adjacent to a short
H.264 boundary, so ten-frame clips now use a two-frame guard. Media structure,
exact frame count and duration remain mandatory.

The production fixture intentionally contains flat-colour holds and fades.
Its 12-image pre-render QC passed, while the generic contrast heuristic marked
five valid full-render samples uniform. The benchmark therefore opts in to
`allowUniformFrames`; this does not relax decode, codec, resolution, cadence,
frame-count or duration validation. Uniform acceptance remains explicit and
strict remains the default.

Isolated live cases passed: 0–29 (2,640 ms native), 1,500–1,529 (2,158 ms
native), render after reopening the saved `.cv`, stale MCP-item purge while an
unrelated Render Manager item was retained, and an opt-in 0–59 segmented run
as two exact 30-frame segments. A client-aborted 0–1,499 render demonstrated
that native cancellation can leave the Render Manager unusable even after a
nominal idle response. Cancellation now runs clean-host recovery when a
checkpoint exists; the host returned idle and the following ten-frame render
passed (514 ms native).

Two cold operations on the 140-layer scene legitimately exceeded the generic
15-second bridge deadline: the first QC frame and the immediate active-comp
query after reopen. Both paths now have a bounded 60-second window. The full
required benchmark then passed in 417,812.72 ms total: compile 169,989.63 ms,
verify 937.71 ms, 12-image QC 23,210.75 ms, correction 120.97 ms, and full
render 222,691.88 ms. It reported zero invalid reads, zero incidents, zero raw
scripts and zero direct bridge calls. Compact evidence is in
`coverage/reliability/render-live-branch.json` and
`coverage/motion-compiler-benchmark-external-live-render.json`.

Fault injection for reliability testing is set by the process that launches
the server, never by a client:
`CAVALRY_FAULT_INJECTION=render.kill_host_after_start|render.stall|render.corrupt_output|render.fail_configure[:count]`.

## Compiler state survives restarts

- State (manifest, manifest/scene hashes, revision, compiled/dirty sets,
  element index, render history) is written after every mutation to
  `<data dir>/projects/<id>/state.json`. It is also written beside saved
  scenes and render checkpoints as `<scene>.cv.motion.json`.
- Elements have stable semantic ids (`sceneId.elementId`, plus
  `sceneId.__background`) mapped to `{layerId, uuid}`. Corrections address
  layers by UUID, which survives save and reopen.
- `motion_project_attach_current` restores from memory, the state file, or
  the active scene's sidecar. It re-resolves every element (UUID → layer id →
  the compiler's deterministic name) and marks scenes with missing elements
  dirty.
- Retiming dirties only the changed scene and later ones. Corrections report
  `affectedRanges`. A dry-run correction no longer mutates the manifest (a
  bug fixed here).

## Evidence and transcripts

- The server writes a JSONL transcript of every tool call
  (`CAVALRY_TRANSCRIPT_PATH`, default `<data dir>/transcripts/`). It is
  authoritative whichever client drives the session.
- `analyzeProductionSequence` checks that a run contains
  `plan → compile → verify → preview → render → inspect → correct → rerender`,
  and flags low-level bridge tools (`cavalry_raw_script`, `cavalry_batch`,
  `safe_host_operation`).
- Primitive certification: each of the 16 primitives' compiled
  implementation is fingerprinted. `motion_project_create` reports which
  primitives are certified, pending approval, or changed since approval. No
  primitive has been visually approved yet.

## Remaining reliability work

- The render-isolation, 25-case torture, end-to-end acceptance, and
  release-gate harnesses still need their repeated live runs. Phase 3 proved
  the individual render behaviours but does not satisfy 10/10 gates.
- Primitive reference rendering and visual approval remain outside these
  render-reliability gates.

## Release gates (open)

| Gate | Status |
|---|---|
| 10/10 clean full-length renders | Not run |
| 10/10 save/reopen/render cycles | Not run |
| No uncaptured Cavalry JavaScript errors | Phase 3: 0 dialog-class incidents; repeated gate not yet run |
| Automatic recovery from one forced render failure | Cancellation recovery passed; injected forced-failure gate not yet run |
| Full external MCP production run without bridge bypass | PASS once: 10 MCP calls, 0 raw scripts, 0 direct bridge calls |
| Corrected final draft in ≤ 20 minutes | PASS once: 417.81 s (6.96 min); repeated acceptance gate not yet run |
