# Cavalry 2.7.2 Capability Routes

Generated from the reconciled 62-group capability matrix.

## Application.NativeCallbacks

Capability identifier: Application.NativeCallbacks.
Coverage: STRUCTURED.
MCP tools: events_subscribe, events_poll, events_get_recent.


## Application.State

Capability identifier: Application.State.
Coverage: STRUCTURED.
MCP tools: app_state, app_is_active, app_active_tool.


## Application.ProcessEvents

Capability identifier: Application.ProcessEvents.
Coverage: STRUCTURED.
MCP tools: bridge_flush_events.


## Coediting.OptimisticConflictDetection

Capability identifier: Coediting.OptimisticConflictDetection.
Coverage: STRUCTURED.
MCP tools: events_status, cavalry_batch.
Native callbacks advance sceneRevision; batches with expectedRevision abort as EDIT_CONFLICT when human edits intervene.

## EditableShape.PathReadWrite

Capability identifier: EditableShape.PathReadWrite.
Coverage: STRUCTURED.
MCP tools: path_get_editable, path_set_editable.


## EditableShape.PointSelection

Capability identifier: EditableShape.PointSelection.
Coverage: STRUCTURED.
MCP tools: path_select_points, path_deselect_points, path_get_selected_points.


## EditableShape.PointTransform

Capability identifier: EditableShape.PointTransform.
Coverage: STRUCTURED.
MCP tools: path_move_selected_points, path_set_point_position, path_set_handle_position.


## EditableShape.ContourEditing

Capability identifier: EditableShape.ContourEditing.
Coverage: STRUCTURED.
MCP tools: path_add_contour, path_remove_contour, path_add_point, path_remove_point, path_close_contour, path_open_contour.


## EditableShape.PathAnimation

Capability identifier: EditableShape.PathAnimation.
Coverage: STRUCTURED.
MCP tools: path_morph_safe, path_animation_safe, path_keyframe_create, path_keyframe_set, path_keyframe_resync, path_morph.
Native path keyframe/resync routes fail fast as KNOWN_HOST_LIMITATION on 2.7.2; verified safe helpers build persistent frame-sampled Editable Shape sequences with topology validation.

## Selection.Layers

Capability identifier: Selection.Layers.
Coverage: STRUCTURED.
MCP tools: layer_select, layer_get_selection.


## Selection.Attributes

Capability identifier: Selection.Attributes.
Coverage: STRUCTURED.
MCP tools: attribute_get_selection, attribute_select, attribute_deselect.


## Selection.Keyframes

Capability identifier: Selection.Keyframes.
Coverage: STRUCTURED.
MCP tools: keyframe_get_selected_ids, keyframe_select, keyframe_deselect_all.


## Selection.PointsAndHandles

Capability identifier: Selection.PointsAndHandles.
Coverage: STRUCTURED.
MCP tools: path_get_selected_points, path_select_points.


## Selection.Assets

Capability identifier: Selection.Assets.
Coverage: GENERIC_ATTRIBUTE.
MCP tools: none.
Asset Window objects are inspectable; the public API has no independent asset-selection setter.

## Transform.MoveFreezeResetPivot

Capability identifier: Transform.MoveFreezeResetPivot.
Coverage: STRUCTURED.
MCP tools: transform_move, transform_freeze, transform_reset, transform_center_pivot.


## Transform.Query3D

Capability identifier: Transform.Query3D.
Coverage: STRUCTURED.
MCP tools: transform_has_3d.


## Transform.Toggle2_5D

Capability identifier: Transform.Toggle2_5D.
Coverage: UNSUPPORTED.
MCP tools: none.
Cavalry 2.7.2 documents has3dTransforms() but no public enable/disable operation.

## Camera.PlanarCamera

Capability identifier: Camera.PlanarCamera.
Coverage: STRUCTURED.
MCP tools: camera_create, camera_list, camera_inspect, camera_look_at, camera_cut, camera_transition, camera_sequence_create, camera_set_type.
Direct cameraType mutation fails fast on 2.7.2; normal Planar Camera attributes and semantic cut/transition helpers are the verified route.

## Camera.ActiveCamera

Capability identifier: Camera.ActiveCamera.
Coverage: STRUCTURED.
MCP tools: camera_get_active, camera_has_active.


## Camera.Guides

Capability identifier: Camera.Guides.
Coverage: UNSUPPORTED.
MCP tools: camera_create_guide, camera_sequence_guides, camera_add_guide, camera_remove_guide, camera_sequence_create.
Native Camera Guide operations are host-unstable and now fail fast. camera_sequence_create is the verified semantic replacement, but it does not claim native Guide parity.

## RulerGuides

Capability identifier: RulerGuides.
Coverage: STRUCTURED.
MCP tools: guide_list, guide_create_horizontal, guide_create_vertical, guide_delete, guide_clear.


## ControlCentre.AddRemove

Capability identifier: ControlCentre.AddRemove.
Coverage: STRUCTURED.
MCP tools: control_centre_add_attribute, control_centre_remove_attribute.


## ControlCentre.ListDescribe

Capability identifier: ControlCentre.ListDescribe.
Coverage: UNSUPPORTED.
MCP tools: none.
The public API exposes add/remove only; the tools return a specific unsupported error.

## Attribute.LimitOverrides

Capability identifier: Attribute.LimitOverrides.
Coverage: STRUCTURED.
MCP tools: attribute_limits_get, attribute_limits_set, attribute_limits_clear.


## GraphAttribute.Edit

Capability identifier: GraphAttribute.Edit.
Coverage: STRUCTURED.
MCP tools: graph_attribute_get, graph_attribute_set, graph_attribute_apply_preset.


## Beat.NativeTiming

Capability identifier: Beat.NativeTiming.
Coverage: STRUCTURED.
MCP tools: beat_get_nth, beat_generate_markers.


## Beat.SyncUtilities

Capability identifier: Beat.SyncUtilities.
Coverage: GENERIC_ATTRIBUTE.
MCP tools: none.
Use beat_get_nth plus batch keyframe/layer operations; there is no distinct Cavalry sync API.

## Layer.UserData

Capability identifier: Layer.UserData.
Coverage: STRUCTURED.
MCP tools: metadata_set, metadata_get, metadata_has.


## MCP.PersistentState

Capability identifier: MCP.PersistentState.
Coverage: STRUCTURED.
MCP tools: mcp_state_get, mcp_state_set.


## Preferences.ReadWrite

Capability identifier: Preferences.ReadWrite.
Coverage: STRUCTURED.
MCP tools: preferences_get, preferences_set.


## Preferences.EnumerateKnown

Capability identifier: Preferences.EnumerateKnown.
Coverage: UI_ACCESSIBILITY.
MCP tools: preferences_list.
The optional macOS driver enumerates the active Cavalry profile; keyed reads/writes remain structured API operations.

## Viewport.Capture

Capability identifier: Viewport.Capture.
Coverage: STRUCTURED.
MCP tools: viewport_capture.


## Viewport.ActiveTool

Capability identifier: Viewport.ActiveTool.
Coverage: STRUCTURED.
MCP tools: viewport_active_tool, tool_get_active.


## Viewport.SetTool

Capability identifier: Viewport.SetTool.
Coverage: UI_ACCESSIBILITY.
MCP tools: tool_set_active.
Verified against the deterministic Tool menu with tool_get_active readback.

## Viewport.QAProfiles

Capability identifier: Viewport.QAProfiles.
Coverage: STRUCTURED.
MCP tools: viewport_prepare_for_visual_qa, viewport_restore.
Profiles take explicit version-appropriate preference settings and always return the prior values for restoration.

## Project.Paths

Capability identifier: Project.Paths.
Coverage: STRUCTURED.
MCP tools: project_get, project_paths, project_set, project_clear.


## Assets.GroupsSequencesCloudData

Capability identifier: Assets.GroupsSequencesCloudData.
Coverage: STRUCTURED.
MCP tools: asset_group_create, asset_sequence_inspect, asset_google_sheet_inspect, asset_google_sheet_replace.


## Assets.SmartFolders

Capability identifier: Assets.SmartFolders.
Coverage: STRUCTURED.
MCP tools: asset_smart_folder_create.


## Color.AssetICC

Capability identifier: Color.AssetICC.
Coverage: STRUCTURED.
MCP tools: color_asset_profile.


## Color.WorkingAndViewportSpaces

Capability identifier: Color.WorkingAndViewportSpaces.
Coverage: GENERIC_ATTRIBUTE.
MCP tools: none.
Available only when exposed by current composition/preferences definitions.

## DynamicRendering

Capability identifier: DynamicRendering.
Coverage: STRUCTURED.
MCP tools: render_dynamic_index_get, render_dynamic_index_connect, render_dynamic_offset.


## RenderQueue.GenericItems

Capability identifier: RenderQueue.GenericItems.
Coverage: STRUCTURED.
MCP tools: render_item_create, render_item_inspect, render_item_set, render_item_set_range, render_item_set_output.


## Render.BackgroundStart

Capability identifier: Render.BackgroundStart.
Coverage: STRUCTURED.
MCP tools: render_background_start.


## Render.Cancel

Capability identifier: Render.Cancel.
Coverage: STRUCTURED.
MCP tools: render_cancel.


## Render.StatusAndWait

Capability identifier: Render.StatusAndWait.
Coverage: UNSUPPORTED.
MCP tools: none.
No documented Cavalry 2.7.2 active-render status query exists, so reliable wait cannot be implemented.

## Render.ScriptsAndMetadata

Capability identifier: Render.ScriptsAndMetadata.
Coverage: STRUCTURED.
MCP tools: render_script_get, render_script_set_setup, render_script_set_pre, render_script_set_post, render_metadata_enable, render_metadata_add, render_metadata_format.


## Render.FormatsAndCodecs

Capability identifier: Render.FormatsAndCodecs.
Coverage: GENERIC_ATTRIBUTE.
MCP tools: render_item_set_format, render_item_set_audio, render_mux_audio.
Installed generators are discovered generically. render_mux_audio supplies and ffprobe-verifies audio for HEVC/ProRes video when Cavalry 2.7.2 exposes no codec audio attributes.

## Layer.SuperTypes

Capability identifier: Layer.SuperTypes.
Coverage: STRUCTURED.
MCP tools: layer_get_supertypes.


## Shape.FillStrokeState

Capability identifier: Shape.FillStrokeState.
Coverage: STRUCTURED.
MCP tools: shape_has_fill, shape_enable_fill, shape_disable_fill, shape_has_stroke, shape_enable_stroke, shape_disable_stroke.


## Layer.StackActions

Capability identifier: Layer.StackActions.
Coverage: STRUCTURED.
MCP tools: layer_bring_forward, layer_bring_to_front, layer_send_backward, layer_send_to_back.


## Scene.ComponentExport

Capability identifier: Scene.ComponentExport.
Coverage: STRUCTURED.
MCP tools: scene_export_copy, component_export_selected.


## Clipboard.Text

Capability identifier: Clipboard.Text.
Coverage: STRUCTURED.
MCP tools: clipboard_get_text, clipboard_set_text.


## NativeDialogs

Capability identifier: NativeDialogs.
Coverage: UNSUPPORTED.
MCP tools: dialog_open_file, dialog_save_file, dialog_choose_folder.
Accessibility path submission was not deterministic under Cavalry's file filters. The tools return PLATFORM_LIMITATION and direct callers to verified scene_open, scene_save_as, and project_set routes.

## UI.CommandSearch

Capability identifier: UI.CommandSearch.
Coverage: UI_ACCESSIBILITY.
MCP tools: command_search, command_execute.
Verified against live Cavalry menu command enumeration and exact command execution.

## UI.Shortcuts

Capability identifier: UI.Shortcuts.
Coverage: UI_ACCESSIBILITY.
MCP tools: shortcut_discover, shortcut_execute.
Verified against live menu shortcuts and explicit key dispatch; user overrides are read from the active profile.

## UI.VisionFallback

Capability identifier: UI.VisionFallback.
Coverage: UNSUPPORTED.
MCP tools: none.
No verified vision interaction driver is currently implemented.

## Presets

Capability identifier: Presets.
Coverage: UNSUPPORTED.
MCP tools: preset_list, preset_apply, preset_save, preset_delete, preset_rename, preset_set_default, preset_clear_default.
The live presets path is discoverable and concrete preset menu commands can be executed, but the clean profile has no preset fixture and Cavalry exposes no stable generic mutation contract.

## Tags

Capability identifier: Tags.
Coverage: UNSUPPORTED.
MCP tools: tag_list, tag_create, tag_delete, tag_assign, tag_unassign, tag_select, tag_filter_scene, tag_filter_viewport, tag_clear_filter.
Tag controls remain PLATFORM_LIMITATION: Cavalry 2.7.2 exposes neither scripting methods nor stable Accessibility identifiers for generic tag mutation.

## WorkspacesAndWindows

Capability identifier: WorkspacesAndWindows.
Coverage: UI_ACCESSIBILITY.
MCP tools: workspace_list, workspace_switch, workspace_save, workspace_reset, window_open, window_close, viewport_add, focus_mode.
Workspace enumeration, window commands, and Focus Mode pass live. Persistent layout mutations remain explicitly interactive and were not run unattended.

## ThirdParty.SceneNodes

Capability identifier: ThirdParty.SceneNodes.
Coverage: GENERIC_ATTRIBUTE.
MCP tools: none.
Dynamic type, attribute, generator, and connection inspection covers plugin scene nodes.

## ThirdParty.CustomUI

Capability identifier: ThirdParty.CustomUI.
Coverage: UNSUPPORTED.
MCP tools: none.
Custom plugin UI outside node attributes requires a future accessibility driver.

## RawScript.EscapeHatch

Capability identifier: RawScript.EscapeHatch.
Coverage: RAW_SCRIPT.
MCP tools: cavalry_raw_script.
Disabled by default and requires CAVALRY_ALLOW_RAW_SCRIPT=true.

