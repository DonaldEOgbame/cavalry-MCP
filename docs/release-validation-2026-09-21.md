# Cavalry MCP Release Validation — 2026-09-21

## Release classification

**Conditional release candidate for the verified generic workflows.**

This is not classified as maximum practical parity. The programmable surface is
fully accounted for with `UNKNOWN = 0`, but Cavalry 2.7.2 has reproduced native
host failures and several environment-specific routes still lack dedicated
fixtures.

## Final inventory

| Metric | Result |
|---|---:|
| Runtime MCP tools | 340 |
| Callable Cavalry API names | 358 unique / 359 qualified |
| Concrete node types | 436 |
| Node attributes | 3,168 total / 2,992 concrete-node attributes |
| Capability groups | 62 |
| UNKNOWN | 0 |

API surface classification:

| Route | Count |
|---|---:|
| Structured | 183 |
| Raw-script fallback | 130 |
| Context-only | 27 |
| Script UI bridge | 4 |
| Script UI | 31 |

Capability-group classification:

| Route | Count |
|---|---:|
| Structured | 43 |
| Generic attribute/graph route | 5 |
| Raw script | 1 |
| Explicitly unsupported/UI-only | 13 |

Node routing is 268 structured, 132 generic, and 36 schema-internal or
independently unavailable, with no unknown node.

## Live validation

The registered-handler ledger accounts for 340/340 tools:

- 289 direct PASS results.
- 26 routes invoked in live mutation/isolation runs and quarantined after a
  reproduced timeout or delayed host exit.
- 2 Camera Guide routes with prior live failure evidence.
- 2 dependent Camera Guide routes not replayed without a safe guide fixture.
- 9 documented host/API limitations excluded from repeated destabilizing runs.
- 12 specialized asset/audio routes without a semantically valid fixture in the
  all-tool sweep.

Conservative live-executed tool count: **317**. Accounted but not directly
invoked with a valid fixture in this campaign: **23**. There are no unclassified
failures and no missing registered tools.

Persistence-tested routes: **18** (`scene_new`, save/save-as/open/import,
checkpoint/restore/snapshot/diff/export-copy, layer serialize/deserialize,
component export/export-selected/import, and template create/instantiate).

Artifact-producing render/preview routes tested: **6** (`preview_frame`,
`preview_frames`, `preview_contact_sheet`, `preview_video`, `viewport_capture`,
and `render_start`). All 14 installed format generators were exercised: 12 pass,
with HEVC and ProRes video passing but audio export unavailable.

The 22 broad live acceptance workflows pass across a state-preserving split run:
tests 1–20 passed before a native host exit; tests 21–22 passed on a fresh host,
including third-party plugin discovery/mutation/render and the complete motion
graphic workflow.

## Knowledge Engine

| Verified corpus type | Count |
|---|---:|
| Total records | 1,641 |
| Official documentation | 1,184 |
| Official API records | 375 |
| Real scenes | 26 |
| Verified scripts | 9 |
| Recipes | 12 |
| Components | 3 |
| Failure/workaround records | 18 |
| Approved visual outcomes | 14 |

All 1,641 records are verified, duplicate rate is zero, provenance/metadata
audits are clean, and the knowledge coverage matrix reports no gaps.

The final knowledge-assisted workflow passed: blank scene, knowledge search,
motion plan, construction, multi-frame preview, visual correction, save/reopen,
structural ingestion, final frames, and editable project. The existing final MP4
was revalidated with `ffprobe` at H.264, 960×540, 30 fps, 3.0 seconds, 162,278
bytes; its MD5 still matches the recorded evidence.

## Soak and compatibility

- 100/100 build/edit/save/reopen/render cycles passed.
- Latency: 391.33 ms mean, 365 ms p50, 608 ms p95.
- RSS delta: +81,376 KB; file-handle delta: +5.
- Two expected tracked output files remained; no process loss occurred.
- Fonts and missing-font detection passed.
- Latin, Arabic/RTL, Japanese, and emoji content persisted; a real preview was
  visually inspected and measured at luma 36–235 after layout correction.
- Unicode/RTL filesystem paths saved and reopened.
- A 1,000-instance procedural graph and 3,000-frame timeline persisted.
- A 2,048px PNG reported `sRGB IEC61966-2.1` after clean-host reload.

## Automated checks

- Unit/bridge tests: **47/47 pass**.
- TypeScript build: **pass**.
- Surface audit: **UNKNOWN 0**.
- Node routes with `verifiedLive: false`: **0**.
- Human-edit/MCP-edit conflict: stale revision correctly returns `EDIT_CONFLICT`.
- Bridge disconnect/reconnect: clean recovery and new-scene operation passed.

## Remaining gaps and limitations

1. Camera Guide creation, `camera_set_type`, Editable Path keyframe/resync/morph,
   and shared-process timeline playback can terminate or block Cavalry 2.7.2.
2. Two dependent Camera Guide routes were not replayed without a safe fixture.
3. Google Sheet, image-sequence, Smart Folder, and dedicated per-handler audio
   fixtures remain incomplete in the all-tool sweep. Audio itself is covered by
   acceptance and render-format validation.
4. HEVC and ProRes do not expose audio-export attributes in the live runtime.
5. Thirteen capability groups are explicitly unsupported/UI-only, not unknown.
6. ICC inspection may be empty in a long-lived stressed host; a bounded reload
   and clean process produced the verified sRGB result.

