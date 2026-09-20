# Cavalry MCP Tool Reference

This document provides a comprehensive reference for all tools exposed by the **Cavalry Model Context Protocol Server**.

---

## 1. System & Discovery Tools

| Tool | Parameters | Description |
|---|---|---|
| `cavalry_ping` | None | Pings the Cavalry bridge to verify reachability and measure round-trip latency. |
| `cavalry_health` | None | Returns full status: Cavalry version, active composition ID, scene file path, and unsaved changes. |
| `cavalry_capabilities` | None | Discovers installed layer types, generator slots, tangent capabilities, and version features. |
| `cavalry_bridge_info` | None | Returns bridge host, port, protocol version, and system hardware info. |
| `cavalry_batch` | `operations: BatchOperation[]`, `stopOnError?: boolean` | Executes multiple operations atomically in one round-trip with `$symbol` reference resolution. |
| `cavalry_raw_script` | `code: string` | Escape hatch to evaluate raw JavaScript in Cavalry (disabled by default). |

---

## 2. Scene Operations

| Tool | Parameters | Description |
|---|---|---|
| `scene_new` | None | Discards current scene and creates a blank project. |
| `scene_open` | `path: string`, `force?: boolean` | Opens a `.cv` scene file. |
| `scene_save` | None | Saves the current scene in place. |
| `scene_save_as` | `filePath: string` | Saves the scene to a designated `.cv` path. |
| `scene_has_unsaved_changes` | None | Returns boolean dirty status. |
| `scene_import` | `path: string` | Imports `.cv` or `.cvc` file into current project. |
| `scene_inspect` | `detailed?: boolean` | Inspects all scene layers, markers, assets, and hierarchy. |
| `scene_describe` | `compact?: boolean` | Token-efficient AI overview of scene structure. |
| `scene_checkpoint` | None | Creates an in-memory snapshot for temporary recovery. |
| `scene_restore_checkpoint` | `data: string` | Restores scene state from a checkpoint string. |
| `scene_snapshot` | None | Serializes all scene layers and their input connections. Composition and application settings outside that layer graph are not included. |
| `scene_diff` | `beforeSnapshot: string`, `afterSnapshot: string` | Computes structural changes (+ added, - removed, ~ modified). |

---

## 3. Composition Tools

| Tool | Parameters | Description |
|---|---|---|
| `composition_list` | None | Lists all compositions in the scene with active status. |
| `composition_create` | `name: string`, `width?: number`, `height?: number`, `fps?: number`, `startFrame?: number`, `endFrame?: number` | Creates a new composition with exact frame bounds and resolution. |
| `composition_get_active` | None | Returns active composition settings (resolution, fps, frameRange, background). |
| `composition_set_active` | `compId: string` | Switches active composition in the editor. |
| `composition_inspect` | `compId?: string` | Inspects composition dimensions, frame range, and motion blur settings. |
| `composition_update` | `compId?: string`, `width?: number`, `height?: number`, `fps?: number`, `startFrame?: number`, `endFrame?: number`, `backgroundColor?: any` | Updates active composition parameters. |
| `composition_precompose` | `layerIds: string[]`, `name?: string` | Precomposes selected layers into a new composition reference. |
| `composition_create_reference`| `compId: string` | Adds a reference of an existing composition into the active composition. |
| `composition_add_override` | `layerId: string`, `attrPath: string` | Promotes an internal precomp attribute to a composition override. |
| `composition_remove_override` | `layerId: string`, `attrPath: string` | Removes an override attribute. |
| `composition_list_overrides` | `referenceId: string` | Lists active overrides on a composition reference. |

---

## 4. Layer Management Tools

| Tool | Parameters | Description |
|---|---|---|
| `layer_types` | `includeExperimental?: boolean` | Discovers all available layer types from the live runtime. |
| `layer_create` | `layerType: string`, `name?: string` | Creates a layer of any discovered type. |
| `layer_create_primitive` | `primitiveType: string`, `name?: string` | Creates primitive shapes (rectangle, ellipse, star, polygon). |
| `layer_inspect` | `layerId: string`, `includeAttributes?: boolean` | Reads UUID, layerId, type, parent, children, bounds, in/out frame. |
| `layer_list` | `allScene?: boolean`, `topLevelOnly?: boolean` | Lists all layers in the composition or scene. |
| `layer_list_by_type` | `layerType: string` | Filters layers by type (e.g. `textShape`). |
| `layer_find` | `name?: string`, `type?: string`, `pattern?: string` | Searches layers by substring or regex pattern. |
| `layer_rename` | `layerId: string`, `newName: string` | Renames layer in the scene tree. |
| `layer_duplicate` | `layerId: string` | Duplicates a layer. |
| `layer_delete` | `layerIds: string \| string[]` | Deletes layers from scene. |
| `layer_parent` | `childLayerId: string`, `parentLayerId: string` | Attaches a child layer to a parent layer. |
| `layer_unparent` | `layerId: string` | Moves layer up one hierarchy level. |
| `layer_children` | `layerId: string` | Lists direct child layer identities. |
| `layer_parent_info` | `layerId: string` | Gets parent identity. |
| `layer_reorder` | `layerId: string`, `underLayerId: string` | Reorders layer stack position. |
| `layer_select` | `layerIds: string[]` | Sets editor selection. |
| `layer_get_selection` | `sortByHierarchy?: boolean` | Gets currently selected layers. |
| `layer_bounding_box` | `layerId: string`, `worldSpace?: boolean` | Computes geometry bounds (`x`, `y`, `width`, `height`). |
| `layer_set_in_frame` | `layerId: string`, `frame: number` | Sets layer clip in-point. |
| `layer_set_out_frame` | `layerId: string`, `frame: number` | Sets layer clip out-point. |
| `layer_visibility` | `layerId: string`, `visible?: boolean` | Toggles or reads layer visibility. |
| `layer_solo` | `layerId: string`, `solo?: boolean` | Toggles or reads layer solo state. |
| `layer_is_shape` | `layerId: string` | Checks if layer has editable vector geometry. |

---

## 5. Attribute System

| Tool | Parameters | Description |
|---|---|---|
| `attribute_list` | `layerId: string` | Lists all attribute paths on a layer. |
| `attribute_describe` | `layerId: string`, `attrPath: string` | Returns attribute data type, bounds, default value, and enum options. |
| `attribute_get` | `layerId: string`, `attrPath: string` | Reads current attribute value. |
| `attribute_get_many` | `layerId: string`, `attrPaths: string[]` | Reads multiple attributes in one call. |
| `attribute_set` | `layerId: string`, `attrPath: string`, `value: any` | Sets an attribute value. |
| `attribute_set_many` | `layerId: string`, `attributes: Record<string, any>` | Sets a dictionary of attribute key-value pairs. |
| `attribute_reset` | `layerId: string`, `attrPath: string` | Resets attribute to default value. |
| `attribute_exists` | `layerId: string`, `attrPath: string` | Checks if attribute path exists on layer. |
| `attribute_add_dynamic` | `layerId: string`, `attrId: string`, `attrType: string` | Adds dynamic attribute to supported layer. |
| `attribute_remove_dynamic` | `layerId: string`, `attrPath: string` | Removes dynamic attribute. |
| `attribute_array_add` | `layerId: string`, `attrId: string` | Appends item to array attribute. |
| `attribute_array_remove` | `layerId: string`, `attrPath: string` | Removes item from array attribute. |
| `attribute_array_reorder` | `layerId: string`, `attrId: string`, `fromIndex: number`, `toIndex: number` | Reorders items in array attribute. |
| `attribute_expression_get` | `layerId: string`, `attrPath: string` | Reads procedural math expression. |
| `attribute_expression_set` | `layerId: string`, `attrPath: string`, `expression: string` | Sets procedural math expression (e.g. `"*2"`, `"+100"`). |
| `attribute_expression_remove` | `layerId: string`, `attrPath: string` | Removes procedural expression. |

---

## 6. Procedural Graph

| Tool | Parameters | Description |
|---|---|---|
| `graph_connect` | `sourceLayerId: string`, `sourceAttr: string`, `targetLayerId: string`, `targetAttr: string`, `force?: boolean` | Wires output attribute to input attribute. |
| `graph_disconnect` | `sourceLayerId: string`, `sourceAttr: string`, `targetLayerId: string`, `targetAttr: string` | Disconnects specific wire between attributes. |
| `graph_disconnect_input` | `layerId: string`, `attrPath: string` | Clears incoming wire on attribute. |
| `graph_disconnect_outputs` | `layerId: string`, `attrPath: string` | Clears all outgoing wires from attribute. |
| `graph_inputs` | `layerId: string` | Lists all incoming connections. |
| `graph_outputs` | `layerId: string` | Lists all outgoing connections. |
| `graph_inspect` | `layerId: string` | Inspects both input and output graph wires. |
| `graph_validate_connection` | `sourceLayerId: string`, `sourceAttr: string`, `targetLayerId: string`, `targetAttr: string` | Validates type compatibility before connecting. |

---

## 7. Generators

| Tool | Parameters | Description |
|---|---|---|
| `generator_list` | `layerId: string` | Lists generator slots and their active types on a layer. |
| `generator_current` | `layerId: string`, `generatorSlot?: string` | Gets current generator type (e.g. `ellipse`, `rectangle`). |
| `generator_set` | `layerId: string`, `generatorType: string`, `generatorSlot?: string` | Switches generator and updates attribute schemas. |
| `generator_describe` | `layerId: string`, `generatorSlot?: string` | Describes generator parameters. |

---

## 8. Animation & Bézier Curves

| Tool | Parameters | Description |
|---|---|---|
| `timeline_get_frame` | None | Gets current playhead frame. |
| `timeline_set_frame` | `frame: number` | Moves timeline playhead. |
| `timeline_play` | None | Starts playback in Cavalry. |
| `timeline_stop` | None | Stops playback. |
| `keyframe_list` | `layerId: string`, `attrPath: string` | Lists all frame numbers with keyframes. |
| `keyframe_create` | `layerId: string`, `attrPath: string`, `frame: number`, `value: any` | Sets keyframe at frame. |
| `keyframe_update` | `layerId: string`, `attrPath: string`, `frame: number`, `newValue: any` | Updates keyframe value. |
| `keyframe_move` | `layerId: string`, `attrPath: string`, `fromFrame: number`, `toFrame: number` | Moves keyframe to another frame. |
| `keyframe_delete` | `layerId: string`, `attrPath: string`, `frame: number` | Deletes keyframe at frame. |
| `keyframe_delete_animation` | `layerId: string`, `attrPath: string` | Clears all animation on attribute. |
| `keyframe_set_interpolation` | `layerId: string`, `attrPath: string`, `frame: number`, `type: 0 \| 1 \| 2` | Sets interpolation: 0 = Bezier, 1 = Linear, 2 = Step. |
| `keyframe_set_tangents` | `layerId: string`, `attrPath: string`, `frame: number`, `angle?: number`, `weight?: number`, `angleLocked?: boolean`, `weightLocked?: boolean` | Configures exact Bézier curve tangents. |
| `keyframe_set_velocity` | `layerId: string`, `attrPath: string`, `frame: number`, `leftSpeed?: number`, `rightSpeed?: number`, `leftInfluence?: number`, `rightInfluence?: number` | Sets curve speed and influence values. |
| `keyframe_clear_velocity` | `layerId: string`, `attrPath: string`, `frame: number` | Resets keyframe velocity. |
| `keyframe_magic_easing` | `layerId: string`, `attrPath: string`, `frame: number`, `easingType: string` | Applies a Cavalry preset such as BounceOut, SlowOut, SpringOut, or OvershootOut. |

---

## 9. Typography Tools

| Tool | Parameters | Description |
|---|---|---|
| `text_create` | `text: string`, `fontFamily?: string`, `fontStyle?: string`, `fontSize?: number`, `color?: string`, `alignment?: 'left'\|'center'\|'right'`, `tracking?: number` | Creates and styles a text layer. |
| `text_set_content` | `layerId: string`, `text: string` | Updates text content string. |
| `text_set_font` | `layerId: string`, `fontFamily: string`, `fontStyle?: string` | Sets font family and weight. |
| `text_set_font_size` | `layerId: string`, `fontSize: number` | Sets font size in points. |
| `text_animate_characters`| `layerId: string`, `startFrame: number`, `duration?: number`, `staggerFrames?: number` | Sets up per-character subMesh animation with stagger. |
| `text_animate_words` | `layerId: string`, `startFrame: number`, `duration?: number`, `staggerFrames?: number` | Sets up per-word entrance animation. |
| `font_list` | None | Lists installed fonts on the host machine. |
| `font_check` | `fontFamily: string` | Checks if a font exists before assigning. |

---

## 10. Paths & Vector Geometry

| Tool | Parameters | Description |
|---|---|---|
| `path_create` | `primitiveType?: string`, `name?: string`, `pathObject?: any` | Creates an editable path shape. |
| `path_inspect` | `layerId: string`, `worldSpace?: boolean` | Reads contours, points, and tangent handles. |
| `path_set_points` | `layerId: string`, `pathObject: any`, `worldSpace?: boolean` | Updates editable path geometry. |
| `shape_centre_pivot` | `layerId: string`, `doCentroid?: boolean` | Centers transform pivot on bounding box or centroid. |
| `svg_convert_to_layers` | `filePath: string` | Converts an SVG file directly into native Cavalry layers. |

---

## 11. Assets & Audio

| Tool | Parameters | Description |
|---|---|---|
| `asset_list` | `topLevelOnly?: boolean` | Lists all items in the Assets window. |
| `asset_inspect` | `assetId: string` | Inspects asset file type and path. |
| `asset_import` | `filePath: string`, `isSequence?: boolean` | Imports asset into project library. |
| `asset_reload` | `assetId: string` | Reloads asset from disk. |
| `asset_replace` | `assetId: string`, `newPath: string` | Swaps asset source file. |
| `asset_delete` | `assetId: string` | Removes asset from project. |
| `asset_add_to_composition` | `assetId: string` | Adds asset footage layer into active composition. |
| `audio_import` | `filePath: string` | Imports audio track. |
| `audio_add_to_composition` | `assetId: string` | Adds audio track to timeline. |
| `audio_set_offset` | `footageLayerId: string`, `frameOffset: number` | Adjusts timeline audio sync offset. |
| `audio_set_in_out` | `footageLayerId: string`, `inFrame: number`, `outFrame: number` | Clips audio playback bounds. |
| `audio_set_volume` | `footageLayerId: string`, `volume: number` | Sets volume (0.0 to 1.0). |
| `audio_probe` | `filePath: string` | Analyzes audio duration and sample rate. |

---

## 12. Time Markers

| Tool | Parameters | Description |
|---|---|---|
| `marker_list` | None | Lists time markers on the active composition timeline. |
| `marker_create` | `frame: number`, `label?: string`, `color?: string` | Creates a time marker for audio sync or cue points. |
| `marker_update` | `markerId: string`, `frame?: number`, `label?: string`, `color?: string` | Updates marker attributes. |
| `marker_move` | `markerId: string`, `frame: number` | Moves marker to new frame. |
| `marker_delete` | `markerId: string` | Removes marker from timeline. |

---

## 13. Preview & Visual Feedback

| Tool | Parameters | Description |
|---|---|---|
| `preview_frame` | `frame?: number`, `scalePercentage?: number`, `outputPath?: string` | Renders a PNG frame for visual evaluation. |
| `preview_frames` | `frames: number[]`, `scalePercentage?: number`, `outputDir?: string` | Renders a sequence of preview frames. |
| `preview_contact_sheet`| `frames: number[]`, `columns?: number`, `scalePercentage?: number`, `outputPath?: string` | Generates a contact sheet image with burned-in frame numbers. |
| `preview_video` | `startFrame: number`, `endFrame: number`, `fps?: number`, `scalePercentage?: number`, `outputPath?: string` | Compiles a preview video or image sequence. |

---

## 14. Render Manager

| Tool | Parameters | Description |
|---|---|---|
| `render_queue_list` | None | Lists active items in Render Manager. |
| `render_queue_add` | `compId?: string` | Adds composition to Render Manager. |
| `render_queue_configure` | `itemId: string`, `settings: Record<string, any>` | Configures output path, format, and frame bounds. |
| `render_start` | `itemId: string` | Initiates render for a queue item. |
| `render_start_all` | None | Starts all queued renders. |
| `render_cancel` | None | Cancels active render job. |

---

## 15. Reusable Components & Templates

| Tool | Parameters | Description |
|---|---|---|
| `layers_serialize` | `layerIds: string[]`, `withConnections?: boolean` | Serializes layer network to JSON. |
| `layers_deserialize` | `jsonString: string` | Instantiates serialized network in active scene. |
| `component_export` | `filePath: string` | Exports selection as `.cvc` component. |
| `component_import` | `filePath: string` | Imports `.cvc` component. |
| `template_create` | `name: string`, `layerIds: string[]`, `storagePath: string` | Saves motion template to disk. |
| `template_instantiate` | `templatePath: string` | Rehydrates template into active composition. |

---

## 16. Layout & Motion Presets

| Tool | Parameters | Description |
|---|---|---|
| `design_center` | `layerId: string` | Centers layer at `(0, 0)`. |
| `design_align` | `layerIds: string[]`, `alignment: 'left'\|'center'\|'right'\|'top'\|'middle'\|'bottom'` | Aligns multiple layers along an axis. |
| `design_distribute` | `layerIds: string[]`, `axis: 'x'\|'y'`, `spacing?: number` | Distributes layers with uniform spacing. |
| `design_create_background` | `color?: string`, `name?: string` | Creates solid background layer matching composition resolution. |
| `motion_fade_in` | `layerId: string`, `startFrame: number`, `duration?: number`, `easing?: string` | Compiles opacity fade-in animation. |
| `motion_fade_out` | `layerId: string`, `startFrame: number`, `duration?: number`, `easing?: string` | Compiles opacity fade-out animation. |
| `motion_slide` | `layerId: string`, `startFrame: number`, `duration?: number`, `deltaX?: number`, `deltaY?: number`, `easing?: string` | Compiles slide-in animation. |
| `motion_scale` | `layerId: string`, `startFrame: number`, `duration?: number`, `fromScale?: number`, `toScale?: number`, `easing?: string` | Compiles scale animation. |
| `motion_pop` | `layerId: string`, `startFrame: number`, `duration?: number` | Compiles overshoot pop animation. |
| `motion_bounce` | `layerId: string`, `startFrame: number`, `duration?: number`, `height?: number` | Compiles gravity bounce animation. |

---

## 17. Cavalry Knowledge Engine

| Tool | Purpose |
|---|---|
| `knowledge_search` | Hybrid search with source, scope, version, verification, category, layer, and tag filters. |
| `knowledge_explain` | Explains a Cavalry concept with graphs, related layers, pitfalls, evidence, and MCP operations. |
| `knowledge_find_scene_pattern` | Retrieves normalized real-scene construction patterns. |
| `knowledge_find_similar_to_current_scene` | Inspects the active scene and runs graph similarity search. |
| `knowledge_find_script_pattern` | Retrieves inert verified/unverified script evidence without execution. |
| `knowledge_find_recipe` | Finds adaptable motion recipes. |
| `knowledge_find_component` | Finds reusable component metadata and limitations. |
| `knowledge_find_failure` | Finds previous failures, causes, and workarounds. |
| `knowledge_find_success_pattern` | Finds verified scripts, scenes, tests, and visual outcomes. |
| `knowledge_get_api` | Returns structured API parameters, results, examples, and MCP equivalents. |
| `knowledge_get_layer_guidance` | Retrieves layer-specific attributes, connections, examples, and pitfalls. |
| `knowledge_get_node_graph` | Returns graph structures or recipe construction for an intent. |
| `motion_plan` | Produces evidence-backed, runtime/MCP-aware implementation guidance before scene mutation. |
| `knowledge_index_current_scene` | Adds the active scene to project/session scope only. |
| `knowledge_record_failure` | Adds scoped failure/workaround memory. |
| `knowledge_record_script` | Adds inert script knowledge; verified status requires passed validation. |
| `knowledge_record_visual_outcome` | Adds a QA-approved project/session visual outcome. |
| `knowledge_sources` / `knowledge_status` / `knowledge_audit` / `knowledge_refresh` | Operates and audits the local corpus. |
