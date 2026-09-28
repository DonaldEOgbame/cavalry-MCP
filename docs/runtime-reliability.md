# Runtime Reliability

Current as of 28 September 2026. This covers the render-reliability P0 work.
Everything below is implemented and covered by offline tests (unit tests,
tests of the real `bridge.js` in a VM, and artifact validation against real
ffmpeg-encoded media). **None of it has been exercised on a live Cavalry host
yet.** The release gates at the end remain open until the macOS runs are
done.

Order of work: [attribute hygiene](attribute-hygiene.md) is the current P0.
Render debugging resumes only after a live benchmark logs zero expected
`Attribute not found` errors, so that render behaviour is measured on a clean
host.

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

## Not done yet (paused for the attribute-hygiene P0)

- Render isolation, 25-case torture and end-to-end acceptance harness
  scripts, the release-gate evaluator, and the primitive reference-render and
  approval script. The shared external-MCP harness (`scripts/lib/`) and the
  production fixture exist.
- All live measurements.

## Release gates (open)

| Gate | Status |
|---|---|
| 10/10 clean full-length renders | Not run |
| 10/10 save/reopen/render cycles | Not run |
| No uncaptured Cavalry JavaScript errors | Capture path implemented; not run live |
| Automatic recovery from one forced render failure | Implemented, simulated in tests; not run live |
| Full external MCP production run without bridge bypass | Session audit implemented; not run live |
| Corrected final draft in ≤ 20 minutes | Not run |
