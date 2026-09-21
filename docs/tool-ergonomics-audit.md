# Tool Ergonomics Audit

Date: 2026-09-21  
Runtime: Cavalry 2.7.2 on macOS

## Decision

No new MCP tools were added during this audit. The runtime registers 340 tools.
The earlier 189 figure counted static registration call sites and is not the
runtime tool inventory; `scripts/generate-tool-inventory.ts` now records the
authoritative registered count.

The generic architecture remains the right interface:

- `layer_create`, `layer_create_primitive`, and `generator_set` cover node
  creation without one tool per node type.
- `attribute_get`, `attribute_set`, array operations, and definition inspection
  cover the 3,168-attribute schema.
- `graph_connect` and serialization tools cover node networks.
- Semantic tools remain limited to repeated workflows where they materially
  reduce error: typography, motion presets, previews, render configuration,
  scene checkpoints, components/templates, and knowledge retrieval.

## Findings

The live sweep found fixture ordering and native-host stability problems, not a
need for more semantic wrappers. Adding wrappers around Camera Guides, Editable
Path keyframes, or timeline playback would only conceal Cavalry 2.7.2 host
limitations. Those routes remain explicit, documented, and quarantined.

`render_item_set_generator` was repaired in place rather than supplemented by
another tool. It now writes flattened `generator.*` attributes and verifies the
readback. MP4 settings pass live; absent HEVC/ProRes audio attributes return a
precise limitation.

## Outcome

- New MCP tools: **0**
- Final runtime MCP tools: **340**
- Generic node architecture retained: **yes**
- One-tool-per-node expansion: **rejected**
- UNKNOWN routes introduced: **0**

