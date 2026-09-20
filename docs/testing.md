# Cavalry MCP Testing Strategy & Acceptance Suite

The Cavalry MCP system includes a three-tiered test architecture designed to verify stability, security, wire protocol integrity, and motion-design execution.

---

## 1. Test Levels

### Tier 1: Unit Tests (Offline / Mock-free)
Verifies components without requiring Cavalry or network sockets:
* **Schema Validation**: Tests Zod schema constraints across all tool inputs.
* **Permission Manager**: Enforces security tier boundaries (`SAFE`, `EXTENDED`, `RAW`, `SYSTEM_EXEC`).
* **Filesystem Sandbox**: Tests path canonicalization, root enforcement, and path traversal rejection.
* **Identity Resolver**: Validates UUIDv4 detection, symbolic references (`$symbol`), and dual-indexing (`uuid` ↔ `layerId`).
* **Metadata Cache**: Tests TTL expiration and prefix invalidation.
* **Error Taxonomy**: Verifies structured error mapping and stack preservation.
* **Scene Diff Engine**: Computes layer additions, deletions, and modifications between JSON snapshots.

Run unit tests:
```bash
npm test
```

---

### Tier 2: Bridge Protocol Tests (Loopback Simulated Server)
Spawns a mock HTTP receiver simulating Cavalry's `api.WebServer` on `127.0.0.1:8999`:
* Validates request encoding and unique request ID assignment.
* Tests the tri-modal response mechanism (WebClient callback, `/get` polling, and response file IPC).
* Tests timeout rejection (`BRIDGE_TIMEOUT`) when the bridge is unresponsive.

Run bridge tests:
```bash
npx tsx --test tests/bridge/*.test.ts
```

---

### Tier 3: Live Cavalry Integration & Acceptance Suite
Executes the **22 Mandatory Acceptance Tests** against an active Cavalry instance.

**Important Rule**: Per strict engineering standards, test results are never faked. If Cavalry is not currently open with the bridge script active, the test runner reports `BLOCKED` with an explanation rather than falsely claiming success.

Run integration tests:
```bash
npm run test:integration
```

---

## 2. The 22 Mandatory Acceptance Tests

| Test | Objective | Verification Method |
|---|---|---|
| **TEST 1 — COMPOSITION** | Create 1920x1080 30fps comp (frames 0–149) | Reads settings back from `composition_get_active` and asserts values. |
| **TEST 2 — TYPOGRAPHY** | Create "HELLO WORLD", set font, size, tracking, alignment, center | Centers with `design_center` and checks position coordinates `(0, 0)`. |
| **TEST 3 — KEYFRAME ANIMATION** | Animate Y (+200 -> 0) and Opacity (0 -> 100) with easing | Queries `keyframe_list` to verify keyframe presence and time indices. |
| **TEST 4 — EXACT CURVE CONTROL** | Modify tangent angle, weight, locking, and velocity | Calls `keyframe_set_tangents` and `keyframe_set_velocity`, verifying parameters. |
| **TEST 5 — PROCEDURAL GRAPH** | Shape -> Duplicator -> Stagger procedural network | Calls `graph_connect` and queries `graph_inputs` to verify wiring. |
| **TEST 6 — UNKNOWN LAYER TYPE** | Dynamic discovery of unmapped layer type | Calls `layer_types`, picks an unmapped type, instantiates it, and inspects attributes. |
| **TEST 7 — ASSETS** | Import SVG asset into project | Calls `asset_import` and verifies asset path in `asset_inspect`. |
| **TEST 8 — SVG TO EDITABLE LAYERS** | Convert SVG to native editable layers | Calls `svg_convert_to_layers` and confirms generated layer count >= 1. |
| **TEST 9 — AUDIO** | Audio file probe and property inspection | Analyzes sample rate, channel count, and duration via `audio_probe`. |
| **TEST 10 — MARKERS** | Create, read, move, and delete time markers | Calls `marker_create`, `marker_move`, and `marker_delete`, verifying timeline state. |
| **TEST 11 — PRECOMP** | Precompose selected layers and verify reference | Precomposes layers and verifies referenced composition ID. |
| **TEST 12 — SERIALIZATION** | Serialize network, delete, and deserialize | Calls `layers_serialize`, deletes originals, then calls `layers_deserialize`. |
| **TEST 13 — PREVIEW FRAME** | Render frame 0 to PNG | Calls `preview_frame` and verifies PNG file exists and has non-zero size. |
| **TEST 14 — CONTACT SHEET** | Render keyframes and tile into contact sheet | Calls `preview_contact_sheet` and confirms generated SVG with burned-in frame badges. |
| **TEST 15 — PREVIEW VIDEO** | Render short low-res preview sequence | Calls `preview_video` and verifies sequence directory or MP4 output. |
| **TEST 16 — FINAL RENDER** | Configure and queue render | Adds composition to Render Manager and configures parameters. |
| **TEST 17 — SAVE AND REOPEN** | Save scene, reopen, resolve UUIDs | Saves `.cv` file, opens with `scene_open`, and verifies layer UUID preservation. |
| **TEST 18 — CHECKPOINT** | Create checkpoint, mutate, and restore | Takes in-memory checkpoint, mutates scene, then restores state. |
| **TEST 19 — BATCH SYMBOL REFERENCES** | Create $A, $B, connect, mutate in 1 round trip | Executes atomic `cavalry_batch` with `$symbol` substitution. |
| **TEST 20 — ERROR SAFETY** | Test invalid paths and permissions | Verifies clean structured errors for disabled raw scripting and forbidden paths. |
| **TEST 21 — THIRD-PARTY LAYER** | Discover, instantiate, mutate, and render a plugin filter | Discovers any `sceneGroup::*` bundled plugin filter via generic `layer_types` (no hardcoded plugin name), creates it with `layer_create`, mutates a plugin-declared attribute via generic `attribute_set`/`attribute_get`, wires it into a target layer's `filters` array via `graph_connect`, and asserts the rendered frame actually changes. Marks `SKIPPED` only if no plugin-style layer is installed at all. |
| **TEST 22 — END-TO-END MOTION GRAPHIC** | Complete autonomous project workflow | Constructs comp, background, kinetic text, subtitle, markers, renders preview, saves project. |
