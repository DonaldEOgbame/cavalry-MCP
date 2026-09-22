# Tool Ergonomics Audit

Date: 2026-09-22
Runtime: Cavalry 2.7.2 on macOS

## Decision

The runtime now registers 385 tools. The 45 additions are semantic recovery,
safe-alternative, render, and opt-in UI tools. No node-specific tool expansion
was made. The earlier 189 figure counted static registration call sites; the
generated runtime inventory is authoritative.

The generic architecture remains the right interface:

- `layer_create`, `layer_create_primitive`, and `generator_set` cover node
  creation without one tool per node type.
- `attribute_get`, `attribute_set`, array operations, and definition inspection
  cover the 3,168-attribute schema.
- `graph_connect` and serialization tools cover node networks.
- Semantic tools remain limited to repeated workflows with important
  invariants, a reproduced failure mode, or a genuine editor-only boundary.

## Findings

The live sweep found native-host stability and editor-only boundaries. Unsafe
native routes remain explicit and fail fast; the new helpers implement alternate
graphs or artifacts instead of disguising the same unstable call.

`render_item_set_generator` was repaired in place rather than supplemented by
another tool. It now writes flattened `generator.*` attributes and verifies the
readback. MP4 settings pass live; absent HEVC/ProRes audio attributes return a
precise limitation.

## Added tools and justification

| Tool | Why it exists |
|---|---|
| `operation_risk_classify` | Exposes SAFE/CAUTION/HOST_UNSTABLE classification before mutation. |
| `safe_host_operation` | Adds checkpoint, timeout, health check, recovery, and structured failure around risky calls. |
| `path_morph_safe` | Replaces host-unstable native morphing with topology-checked interpolation. |
| `path_animation_safe` | Builds a persistent bounded sampled-path animation without native path keyframes. |
| `camera_cut` | Encodes a deterministic camera cut without Camera Guides. |
| `camera_transition` | Encodes a verified camera transform transition without camera-type mutation. |
| `camera_sequence_create` | Enforces camera sequence ordering and keyframe invariants in one operation. |
| `timeline_preview_playback` | Replaces bridge-blocking playback with a rendered preview video. |
| `render_mux_audio` | Produces verified audio-bearing output for HEVC/ProRes video-only renders. |
| `render_status` | Reports real MCP-tracked render state without inventing progress. |
| `ui_driver_status` | Makes optional UI-driver availability and authorization observable. |
| `command_search` | Discovers editor commands before using coordinate-based interaction. |
| `command_execute` | Executes an exact discovered command deterministically. |
| `shortcut_discover` | Reads available command shortcuts and user overrides. |
| `shortcut_execute` | Dispatches an explicit discovered shortcut as a fallback. |
| `preferences_list` | Enumerates the active preference surface when no public enumeration API exists. |
| `tool_set_active` | Selects major editor tools with active-tool readback. |
| `focus_mode` | Exposes the stable editor-only Focus Mode command. |
| `window_open` | Opens a named editor window through discovered menu commands. |
| `window_close` | Provides the paired interactive close operation with explicit limitation handling. |
| `viewport_add` | Represents the editor-only additional-viewport action. |
| `workspace_list` | Enumerates available workspaces from the live menu. |
| `workspace_switch` | Switches a discoverable workspace when a fixture exists. |
| `workspace_save` | Encapsulates the interactive Save Workspace flow. |
| `workspace_reset` | Encapsulates the editor-only workspace reset command. |
| `dialog_open_file` | Makes optional supervised native Open-dialog control explicit. |
| `dialog_save_file` | Makes optional supervised native Save-dialog control explicit. |
| `dialog_choose_folder` | Makes optional supervised folder selection explicit. |
| `preset_list` | Discovers profile presets where Cavalry exposes them. |
| `preset_apply` | Applies a concrete discovered preset through the UI fallback. |
| `preset_save` | Represents preset persistence as an explicit interactive action. |
| `preset_delete` | Represents preset deletion without pretending a scripting API exists. |
| `preset_rename` | Represents preset rename with exact limitation reporting. |
| `preset_set_default` | Encodes the editor-only default-preset action. |
| `preset_clear_default` | Encodes removal of an editor-only default preset. |
| `tag_list` | Provides a discoverable tag surface when available. |
| `tag_create` | Encapsulates tag creation without adding node-specific APIs. |
| `tag_delete` | Encapsulates tag deletion and its interactive boundary. |
| `tag_assign` | Represents assignment as a semantic multi-selection operation. |
| `tag_unassign` | Provides the inverse assignment operation. |
| `tag_select` | Selects layers by a concrete tag when discoverable. |
| `tag_filter_scene` | Exposes the scene tag filter as an editor action. |
| `tag_filter_viewport` | Exposes the viewport tag filter as an editor action. |
| `tag_clear_filter` | Reliably clears any supported tag filter. |
| `third_party_ui_inspect` | Attempts generic Accessibility discovery for plugin custom UI without hard-coding a plugin. |

## Outcome

- New MCP tools: **45**
- Final runtime MCP tools: **385**
- Generic node architecture retained: **yes**
- One-tool-per-node expansion: **rejected**
- UNKNOWN routes introduced: **0**
