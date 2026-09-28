# Production Motion Compiler

Current as of 28 September 2026.

The production interface is a declarative motion compiler, not a remote-control
loop. An MCP client describes project intent once; the server expands that
manifest into verified, scene-sized Cavalry batches.

```text
MCP client
  -> high-level typed motion tools
  -> declarative project/scene manifest
  -> deterministic compiler + incremental scene hashes
  -> internal optimized batches
  -> authenticated loopback bridge
  -> Cavalry API and editable scene
```

The bridge, response files, callbacks, and `timeline_compile_bulk` operation are
implementation details. A normal client must not call them directly. The
guarded `cavalry_raw_script` tool remains an escape hatch and is excluded from
the default production profile.

## Declarative model

A project manifest defines resolution, frame rate, design tokens, reusable
typography styles, components, transitions, global timing, and ordered scenes.
Each scene defines its duration, background, elements, hierarchy, layout, and
motion behaviours. The compiler currently recognizes:

- `enterUp`, `enterDown`, `enterLeft`, and `enterRight`
- `wordSwap`, `verticalRoll`, `progressiveBuild`, and `textReflow`
- `pushTransition`, `scaleTakeover`, `scaleTransfer`, and `zoomThrough`
- `maskedReveal`, `trackingExpansion`, `colorSnap`, and `hardCut`

Example:

```json
{
  "id": "launch-film",
  "name": "Launch Film",
  "resolution": { "width": 1920, "height": 1080 },
  "fps": 30,
  "typographyStyles": {
    "headline": {
      "fontFamily": "Helvetica",
      "fontStyle": "Bold",
      "fontSize": 112,
      "color": "#ffffff",
      "alignment": "center"
    }
  },
  "scenes": [{
    "id": "opening",
    "durationFrames": 60,
    "background": "#111827",
    "elements": [{
      "id": "headline",
      "kind": "text",
      "text": "MOVE WITH INTENT",
      "style": "headline",
      "motions": [
        { "type": "enterUp", "durationFrames": 15 },
        { "type": "trackingExpansion", "startFrame": 20, "durationFrames": 24 }
      ]
    }]
  }]
}
```

## Production tool layers

Layer 1 contains whole-project operations:

- `motion_brief_plan`
- `motion_project_create`, `motion_project_compile`, `motion_project_update`
- `motion_project_verify`, `motion_project_apply_corrections`
- `motion_project_render`, `motion_project_render_review`
- `motion_project_metrics`, `motion_project_attach_current`

Layer 2 contains reusable scene/system operations:

- `motion_scene_build`, `motion_scene_batch_build`
- `motion_sequence_retime`, `scene_timeline_compile`
- `typography_system_create`
- `motion_component_define`, `motion_component_apply`
- `transition_sequence_apply`

Layer 3 is the existing typed Cavalry operation surface. Layer 4 is the
internal bridge. The default `core` profile prioritizes Layers 1 and 2 plus a
small operational/knowledge set (60 tools). `standard` exposes the broad typed
editing surface. `full` exposes all 404 registered tools.

## Compilation and batching

Compilation is deterministic: stable project and scene hashes identify dirty
scenes. The compiler creates composition timing, scene markers, backgrounds,
text/shape layers, visibility spans, and animation state from the manifest.
Keyframes are grouped by layer and frame into a private bulk-timeline bridge
operation, and easing/interpolation work is deduplicated. Scene-sized batches
provide bounded payloads and verified per-step results. A recoverable
`EDIT_CONFLICT` caused by Cavalry's delayed callbacks is retried once against
the updated scene revision.

Project updates compare scene hashes and rebuild only changed scenes.
Corrections address stable `sceneId`/`elementId` pairs and can change visual,
timing, or hierarchy properties in one high-level call. Partial rendering maps
selected scene IDs to one explicit frame range. Compiler state is persisted
after every mutation (data directory, plus a `<scene>.cv.motion.json` sidecar
beside saved scenes and render checkpoints), and generated layers carry stable
semantic ids (`sceneId.elementId`) mapped to Cavalry UUIDs. After a restart,
`motion_project_attach_current` restores that state and re-resolves every
element against the live scene. See [runtime-reliability.md](runtime-reliability.md).

## Visual review and rendering

`motion_project_render_review` renders 1–20 representative PNG frames and
returns them as actual MCP image content, allowing one visual reasoning pass
without shell or filesystem access. The correction manifest can then be
submitted once through `motion_project_apply_corrections`.

`motion_project_render` uses the supervised, disposable render pipeline
described in [runtime-reliability.md](runtime-reliability.md): a checkpoint, a
fresh Render Manager item per attempt with read-back range verification, a
private staging file, artifact validation (codec, resolution, fps, exact frame
count, duration, non-blank and non-frozen frames), clean-host recovery, and
exactly one retry. Full-range rendering is the default; segmentation is an
opt-in fallback (`segmentFrames`).

## External benchmark evidence

The benchmark in `scripts/benchmark-motion-compiler.ts` imports only the
official MCP SDK client and stdio transport. It fails if `cavalry_raw_script`
is exposed or invoked and never imports the bridge client.

Workload: 55 scenes, 3,120 frames (104 seconds), 138 top-level layers, 2,095
keyframes, 2,864 logical compiler operations, two typefaces, all 16 primitives,
12-frame MCP-native QC, and one correction.

| Boundary | Measured result |
|---|---:|
| Dry-run external MCP calls | 4 |
| Estimated legacy MCP calls | 2,984 |
| Call reduction | 99.87% |
| Dry-run total wall time | 358.77 ms |
| Live external MCP calls through correction | 6 |
| Live compile | 51,724.57 ms |
| Live structural verification | 459.36 ms |
| Live 12-image QC | 9,790.14 ms |
| Live correction | 86.18 ms |
| Live total through correction, excluding final MP4 | 62,414.04 ms |
| Optimized bridge operations / batches | 421 / 12 |
| Average optimized batch size | 35.08 |

The full live H.264 acceptance is not yet a pass. The first foreground attempt
revealed that selecting `renderMP4` resets Cavalry's range to its 0–250 default:
the validator rejected the otherwise valid 1920×1080 H.264 because it contained
only 250 frames (8.3 seconds). Render setup now selects the generator before
setting and verifying the explicit range. With that fix, Cavalry no longer
finalizes the incorrect short file, but the 3,120-frame job remains idle with a
zero-byte container on this Cavalry 2.7.2 host. Existing small-format H.264
coverage remains valid, so the open issue is specific to this production-sized
compiled scene/range or its host render state.

Segmented rendering (supervised segments concatenated losslessly) is now an
opt-in fallback (`segmentFrames`), not the default. Its first replay ran after
a cancelled long render had already wedged Render Manager, so it is not yet
clean-host validated. Cavalry **JavaScript Error** dialogs are now captured as
structured, deduplicated incidents correlated to the triggering MCP request
([runtime-reliability.md](runtime-reliability.md)). This has not yet been
exercised live.

The same benchmark log showed about 124,527 `Attribute not found` errors from
the bridge's change-notification handlers and identity lookups, not from
compiler work. That is fixed with a positive capability registry
([attribute-hygiene.md](attribute-hygiene.md)). The live benchmark now fails
on any invalid attribute read. Render debugging resumes on a host that logs
zero such errors, and no claim is made yet that they caused the render
failures.

Accordingly, the redesign has conclusively removed agent/MCP round-trip
explosion. Compile, verification, MCP-native QC, and a corrective edit now take
about 62.4 seconds in total, so the non-render portion exceeds the requested
speed target. The 5–12 minute complete-draft and 8–18 minute corrected-draft
targets are still not release-validated end to end because the long H.264
boundary is unresolved. Reliable sub-10-minute first drafts now require fixing
that host render path and completing one uninterrupted black-box compile/QC/
render/correction/rerender run.

Run the repeatable checks with:

```bash
npm run benchmark:motion
npm run benchmark:motion:live
npm run benchmark:motion:render
```

The render-resume command exists for diagnosing an already compiled active
scene without paying the compile cost again:

```bash
npm run benchmark:motion:render:resume
```
