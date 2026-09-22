import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as Schemas from './schemas.js';
import { CavalryError } from './errors.js';
import { logger } from '../utils/logger.js';

// Cavalry modules
import { getCapabilities, executeBatch, getBridgeInfo } from '../cavalry/capabilities.js';
import { checkBridgeHealth } from '../bridge/health.js';
import { executeRawScript } from '../cavalry/raw-script.js';
import * as Scene from '../cavalry/scene.js';
import * as Comp from '../cavalry/compositions.js';
import * as Layer from '../cavalry/layers.js';
import * as Attr from '../cavalry/attributes.js';
import * as Graph from '../cavalry/graph.js';
import * as Gen from '../cavalry/generators.js';
import * as Anim from '../cavalry/animation.js';
import * as Motion from '../design/animation-presets.js';
import * as Typo from '../design/typography.js';
import * as Path from '../cavalry/paths.js';
import * as Asset from '../cavalry/assets.js';
import * as Audio from '../cavalry/audio.js';
import * as Marker from '../cavalry/markers.js';
import * as Render from '../cavalry/rendering.js';
import * as Serial from '../cavalry/serialization.js';
import * as Preview from '../preview/frames.js';
import * as ContactSheet from '../preview/contact-sheet.js';
import * as Video from '../preview/video.js';
import * as Layout from '../design/layout.js';
import { audioProbe } from '../audio/probe.js';
import * as Events from '../cavalry/events.js';
import * as Parity from '../cavalry/parity.js';
import { cavalryParityAudit } from '../cavalry/coverage.js';
import { knowledgeEngine } from '../knowledge/engine.js';
import { executeSupervised, operationRisk } from '../bridge/watchdog.js';
import * as Safe from '../cavalry/safe-operations.js';
import { renderMuxAudio } from '../cavalry/render-mux.js';
import * as UI from '../ui/driver.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'cavalry-mcp',
    version: '1.0.0',
  });

  // Helper to wrap tool execution with structured JSON response & error safety
  function handleTool(operation: string, fn: (args: any) => Promise<unknown>) {
    return async (args: any) => {
      const startTime = Date.now();
      try {
        const result = await fn(args);
        const durationMs = Date.now() - startTime;
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                ok: true,
                operation,
                result,
                durationMs,
              }, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        const cavalryErr = CavalryError.fromUnknown(err, operation);
        logger.error(`Tool error: ${operation}`, cavalryErr);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                ok: false,
                operation,
                error: cavalryErr.toJSON(),
                durationMs,
              }, null, 2),
            },
          ],
        };
      }
    };
  }

  // ============================================================================
  // SYSTEM TOOLS
  // ============================================================================
  server.tool('cavalry_ping', 'Check if Cavalry and the bridge are reachable', {}, handleTool('cavalry_ping', async () => {
    const health = await checkBridgeHealth();
    return { reachable: health.online, latencyMs: health.latencyMs };
  }));

  server.tool('cavalry_health', 'Inspect complete health, latency, active composition, and scene status', {}, handleTool('cavalry_health', async () => {
    return checkBridgeHealth();
  }));

  server.tool('cavalry_capabilities', 'Dynamically discover installed Cavalry version, supported layer types, generators, and features', {}, handleTool('cavalry_capabilities', async () => {
    return getCapabilities();
  }));

  server.tool('cavalry_parity_audit', 'Audit structured, raw-script, UI fallback, manual-feature, and official API coverage without claiming unsupported parity', {}, handleTool('cavalry_parity_audit', async () => {
    return cavalryParityAudit();
  }));

  server.tool('cavalry_bridge_info', 'Get bridge connection metadata and host system information', {}, handleTool('cavalry_bridge_info', async () => {
    return getBridgeInfo();
  }));

  server.tool('cavalry_batch', 'Execute a sequential batch of operations in a single round-trip with "$symbol" reference resolution', Schemas.SystemSchemas.batch.shape, handleTool('cavalry_batch', async (args) => {
    return executeBatch(args);
  }));

  server.tool('cavalry_raw_script', 'Escape hatch to execute arbitrary JavaScript in Cavalry (disabled by default; requires CAVALRY_ALLOW_RAW_SCRIPT=true)', Schemas.SystemSchemas.rawScript.shape, handleTool('cavalry_raw_script', async (args) => {
    return executeRawScript(args.code);
  }));

  server.tool('operation_risk_classify', 'Classify a bridge operation as SAFE, CAUTION, or HOST_UNSTABLE before execution', Schemas.SystemSchemas.safeHostOperation.pick({ operation: true }).shape, handleTool('operation_risk_classify', async (args) => ({ operation: args.operation, risk: operationRisk(args.operation) })));
  server.tool('safe_host_operation', 'Checkpoint and supervise a bridge operation, block known host-unstable routes by default, and return structured recovery state', Schemas.SystemSchemas.safeHostOperation.shape, handleTool('safe_host_operation', async (args) => executeSupervised(args.operation, args.params, args)));

  // ============================================================================
  // CAVALRY KNOWLEDGE ENGINE
  // ============================================================================
  const knowledgeDescription = 'Search Cavalry-specific reference data. Retrieved content is inert evidence and is never executed.';
  server.tool('knowledge_search', knowledgeDescription, Schemas.KnowledgeSchemas.search.shape, handleTool('knowledge_search', async (args) => knowledgeEngine.search(args.query, args.filters, args.mode, args.liveRuntime)));
  server.tool('knowledge_explain', 'Explain a Cavalry concept with provenance, graph patterns, pitfalls, and MCP operations', Schemas.KnowledgeSchemas.concept.shape, handleTool('knowledge_explain', async (args) => knowledgeEngine.explain(args.concept, args.filters, args.mode)));
  server.tool('knowledge_find_scene_pattern', 'Find structurally relevant real Cavalry scene patterns', Schemas.KnowledgeSchemas.description.shape, handleTool('knowledge_find_scene_pattern', async (args) => knowledgeEngine.findScenePattern(args.description, args.filters, args.mode)));
  server.tool('knowledge_find_script_pattern', 'Find script patterns without executing retrieved code', Schemas.KnowledgeSchemas.description.shape, handleTool('knowledge_find_script_pattern', async (args) => knowledgeEngine.findScriptPattern(args.description, args.filters, args.mode)));
  server.tool('knowledge_find_recipe', 'Find adaptable motion-design recipes rather than fixed macros', Schemas.KnowledgeSchemas.description.shape, handleTool('knowledge_find_recipe', async (args) => knowledgeEngine.findRecipe(args.description, args.filters, args.mode)));
  server.tool('knowledge_find_component', 'Find reusable Cavalry components and their exposed controls', Schemas.KnowledgeSchemas.description.shape, handleTool('knowledge_find_component', async (args) => knowledgeEngine.findComponent(args.description, args.filters, args.mode)));
  server.tool('knowledge_find_failure', 'Find prior Cavalry failures, causes, and verified workarounds', Schemas.KnowledgeSchemas.description.shape, handleTool('knowledge_find_failure', async (args) => knowledgeEngine.findFailure(args.description, args.filters, args.mode)));
  server.tool('knowledge_find_success_pattern', 'Find verified successful scripts, scenes, tests, and visual outcomes', Schemas.KnowledgeSchemas.description.shape, handleTool('knowledge_find_success_pattern', async (args) => knowledgeEngine.findSuccessPattern(args.description, args.filters, args.mode)));
  server.tool('knowledge_get_api', 'Look up structured Cavalry API knowledge and known MCP equivalents', Schemas.KnowledgeSchemas.api.shape, handleTool('knowledge_get_api', async (args) => knowledgeEngine.getApi(args.name, args.filters, args.mode)));
  server.tool('knowledge_get_layer_guidance', 'Get version-aware construction and connection guidance for a Cavalry layer type', Schemas.KnowledgeSchemas.layer.shape, handleTool('knowledge_get_layer_guidance', async (args) => knowledgeEngine.getLayerGuidance(args.layerType, args.filters, args.mode)));
  server.tool('knowledge_get_node_graph', 'Return normalized Cavalry graphs or recipe construction matching an intent', Schemas.KnowledgeSchemas.description.shape, handleTool('knowledge_get_node_graph', async (args) => knowledgeEngine.getNodeGraph(args.description, args.filters)));
  server.tool('knowledge_find_similar_to_current_scene', 'Inspect the active Cavalry scene and rank structurally similar indexed scene graphs', Schemas.KnowledgeSchemas.filters.shape, handleTool('knowledge_find_similar_to_current_scene', async (args) => knowledgeEngine.findSimilarToCurrentScene(args.filters)));
  server.tool('motion_plan', 'Plan a Cavalry-native implementation from knowledge evidence and MCP/runtime capabilities before scene mutation', Schemas.KnowledgeSchemas.plan.shape, handleTool('motion_plan', async (args) => knowledgeEngine.motionPlan(args.goal, args.currentSceneSummary, args.assets, args.liveRuntime)));
  server.tool('knowledge_sources', 'List indexed knowledge sources, scopes, versions, and record counts', {}, handleTool('knowledge_sources', async () => knowledgeEngine.sources()));
  server.tool('knowledge_refresh', 'Incrementally refresh configured local knowledge sources using content hashes', {}, handleTool('knowledge_refresh', async () => knowledgeEngine.refresh()));
  server.tool('knowledge_status', 'Inspect Knowledge Engine storage, scope, source, verification, and version counts', {}, handleTool('knowledge_status', async () => knowledgeEngine.status()));
  server.tool('knowledge_audit', 'Audit provenance, duplicates, staleness, metadata health, and Cavalry knowledge coverage', {}, handleTool('knowledge_audit', async () => knowledgeEngine.audit()));
  server.tool('knowledge_record_failure', 'Store a scoped Cavalry failure and workaround; project scope requires projectId', Schemas.KnowledgeSchemas.failure.shape, handleTool('knowledge_record_failure', async (args) => knowledgeEngine.addFailure(args, args.scope, args.projectId, args.cavalryVersion)));
  server.tool('knowledge_record_script', 'Store script code as inert knowledge; verified status requires passed validation metadata', Schemas.KnowledgeSchemas.script.shape, handleTool('knowledge_record_script', async (args) => knowledgeEngine.addScript(args, args.scope, args.projectId, args.cavalryVersion)));
  server.tool('knowledge_index_current_scene', 'Inspect and index the active user scene in project/session scope only; never promotes it globally', Schemas.KnowledgeSchemas.currentScene.shape, handleTool('knowledge_index_current_scene', async (args) => knowledgeEngine.indexCurrentScene(args.name, args.scope, args.projectId, args.sessionId, args.verified)));
  server.tool('knowledge_record_visual_outcome', 'Record an approved visual outcome in project/session success memory; requires qaPassed=true', Schemas.KnowledgeSchemas.visualOutcome.shape, handleTool('knowledge_record_visual_outcome', async (args) => knowledgeEngine.addVisualOutcome(args, args.scope, args.projectId, args.sessionId, args.cavalryVersion)));
  server.tool('events_subscribe', 'Subscribe the bridge event queue to native Cavalry application callbacks', Schemas.EventSchemas.subscription.shape, handleTool('events_subscribe', async (args) => Events.eventsSubscribe(args.events)));
  server.tool('events_unsubscribe', 'Remove native Cavalry event subscriptions', Schemas.EventSchemas.subscription.shape, handleTool('events_unsubscribe', async (args) => Events.eventsUnsubscribe(args.events)));
  server.tool('events_poll', 'Consume queued Cavalry events and invalidate affected MCP caches', Schemas.EventSchemas.poll.shape, handleTool('events_poll', async (args) => Events.eventsPoll(args.limit)));
  server.tool('events_get_recent', 'Read recent Cavalry events without consuming the queue', Schemas.EventSchemas.poll.shape, handleTool('events_get_recent', async (args) => Events.eventsGetRecent(args.limit)));
  server.tool('events_clear', 'Clear queued and recent Cavalry events', {}, handleTool('events_clear', async () => Events.eventsClear()));
  server.tool('events_status', 'Inspect native callback subscriptions and queue depth', {}, handleTool('events_status', async () => Events.eventsStatus()));
  server.tool('app_state', 'Get Cavalry activity, active tool, platform, version, and licence state', {}, handleTool('app_state', async () => Events.appState()));
  server.tool('app_is_active', 'Check whether Cavalry is the active application', {}, handleTool('app_is_active', async () => Events.appIsActive()));
  server.tool('app_active_tool', 'Get the active Cavalry Viewport tool', {}, handleTool('app_active_tool', async () => Events.appActiveTool()));
  server.tool('app_platform', 'Get the platform reported by Cavalry', {}, handleTool('app_platform', async () => Events.appPlatform()));
  server.tool('app_version', 'Get the live Cavalry application version', {}, handleTool('app_version', async () => Events.appVersion()));
  server.tool('app_license', 'Get the available Cavalry licence restriction state', {}, handleTool('app_license', async () => Events.appLicense()));
  server.tool('bridge_flush_events', 'Flush Cavalry GUI events before a verification read', {}, handleTool('bridge_flush_events', async () => Events.bridgeFlushEvents()));

  const parityTool = (name: string, description: string, schema: any, operation = name, mapArgs?: (args: any) => Record<string, unknown>) => {
    server.tool(name, description, schema.shape ?? schema, handleTool(name, async (args) => Parity.parityCall(operation, mapArgs ? mapArgs(args) : args)));
  };
  const P = Schemas.ParitySchemas;

  // Native editor state and selection domains.
  parityTool('keyframe_get_ids', 'Get stable keyframe IDs for one attribute', P.attribute);
  parityTool('keyframe_get_selected_ids', 'Get exact IDs of selected keyframes', {});
  parityTool('keyframe_select', 'Set the keyframe selection by ID', P.keyframeIds);
  parityTool('keyframe_deselect_all', 'Clear keyframe selection', {});
  parityTool('keyframe_get_attribute_from_id', 'Resolve the attribute owning a keyframe ID', P.keyframeId);
  parityTool('keyframe_get_selected', 'Inspect selected keyframes and their IDs', {});
  parityTool('attribute_get_selection', 'Get the independent Attribute Editor selection', {});
  parityTool('attribute_select', 'Select Attribute Editor paths', P.attributes);
  parityTool('attribute_deselect', 'Deselect Attribute Editor paths', P.attributes);
  parityTool('attribute_clear_selection', 'Clear Attribute Editor selection', {});

  // Editable paths and path animation.
  parityTool('path_make_editable', 'Convert a supported shape to an Editable Shape', P.makeEditable);
  parityTool('path_get_editable', 'Read complete editable contours, points, handles, locks, and selection state', P.layerWorld);
  parityTool('path_set_editable', 'Replace an Editable Shape path in local or world space', P.editablePath);
  parityTool('path_select_points', 'Select specific Editable Shape points', P.pathSelection);
  parityTool('path_deselect_points', 'Clear point and handle selection on an Editable Shape', P.layerWorld);
  parityTool('path_get_selected_points', 'Inspect selected points and handles', P.layerWorld);
  parityTool('path_move_selected_points', 'Move the selected path points with Cavalry hierarchy semantics', P.pointMove);
  parityTool('path_set_point_position', 'Set selected point positions through Cavalry Edit Shape semantics', P.pointPosition);
  parityTool('path_set_handle_position', 'Set one incoming or outgoing handle position', P.pathHandle);
  parityTool('path_set_handle_locking', 'Set angle and weight locks for one path point', P.pathLocking);
  parityTool('path_make_first_point', 'Make the currently selected point the first point', P.layer);
  for (const [name, action, schema] of [
    ['path_add_contour', 'addContour', P.pathAddContour], ['path_remove_contour', 'removeContour', P.pathContour],
    ['path_add_point', 'addPoint', P.pathAddPoint], ['path_remove_point', 'removePoint', P.pathPoint],
    ['path_close_contour', 'closeContour', P.pathContour], ['path_open_contour', 'openContour', P.pathContour],
  ] as const) parityTool(name, `${action} on an Editable Shape`, schema, 'path_edit_contours', (args) => ({ ...args, action }));
  parityTool('path_keyframe_create', 'Create and resynchronise an Editable Path keyframe', P.pathKeyframeSet, 'path_keyframe_set');
  parityTool('path_keyframe_get', 'Read an Editable Path at a keyframe time while restoring the playhead', P.pathKeyframeGet);
  parityTool('path_keyframe_set', 'Set and resynchronise an Editable Path keyframe', P.pathKeyframeSet);
  parityTool('path_keyframe_resync', 'Run Cavalry path-animation resynchronisation', P.attribute);
  parityTool('path_morph', 'Create a resynchronised two-key Editable Path morph', P.pathMorph);

  // Transform, camera, ruler guides, and reusable controls.
  parityTool('transform_move', 'Move selected layers using Cavalry hierarchy-aware movement', P.layersMove);
  parityTool('transform_freeze', 'Freeze a layer transform', P.layer);
  parityTool('transform_reset', 'Reset a layer transform', P.layer);
  parityTool('transform_center_pivot', 'Center a layer pivot', P.pivot);
  parityTool('transform_center_pivot_centroid', 'Center a layer pivot on its shape centroid', P.pivot, 'transform_center_pivot', (args) => ({ ...args, centroid: true }));
  parityTool('transform_get_pivot', 'Get a pivot in local or world space', P.layerWorld);
  parityTool('transform_has_3d', 'Check whether a layer has active 3D transforms', P.layer);
  parityTool('transform_enable_3d', 'Report the unsupported 2.5D toggle explicitly on Cavalry 2.7.2', P.layer, 'camera_layer_2_5d');
  parityTool('camera_create', 'Create a native planar camera', P.cameraCreate);
  parityTool('camera_list', 'List planar cameras in the active composition', {});
  parityTool('camera_get_active', 'Get the active camera', {});
  parityTool('camera_has_active', 'Check for an active camera', {});
  parityTool('camera_inspect', 'Inspect camera type, transforms, look-at target, zoom, and guides', P.layer);
  parityTool('camera_set_type', 'Set native camera mode: freeform, look-at, or guide', P.cameraType);
  parityTool('camera_create_guide', 'Create a native Camera Guide', P.cameraGuideCreate);
  parityTool('camera_sequence_guides', 'Set the ordered Camera Guide sequence', P.cameraGuides, 'camera_set_guides');
  parityTool('camera_add_guide', 'Append one native Camera Guide to a camera', P.cameraGuide);
  parityTool('camera_remove_guide', 'Remove one native Camera Guide from a camera', P.cameraGuide);
  parityTool('camera_look_at', 'Set a camera look-at position and Look At mode', P.cameraLookAt);
  parityTool('camera_enable_layer_2_5d', 'Report the unavailable 2.5D toggle explicitly', P.layer, 'camera_layer_2_5d');
  parityTool('camera_disable_layer_2_5d', 'Report the unavailable 2.5D toggle explicitly', P.layer, 'camera_layer_2_5d');
  parityTool('guide_list', 'List composition ruler guides', P.guideList);
  parityTool('guide_create_horizontal', 'Create a horizontal ruler guide', P.guideCreate, 'guide_create', (args) => ({ ...args, vertical: false }));
  parityTool('guide_create_vertical', 'Create a vertical ruler guide', P.guideCreate, 'guide_create', (args) => ({ ...args, vertical: true }));
  parityTool('guide_move', 'Move a ruler guide, returning its replacement guide ID', P.guideMove);
  parityTool('guide_delete', 'Delete a composition ruler guide', P.guideDelete);
  parityTool('guide_clear', 'Clear composition ruler guides', P.guideList);
  parityTool('control_centre_list', 'Report that Cavalry exposes no supported Control Centre list API', P.guideList);
  parityTool('control_centre_describe', 'Report that Cavalry exposes no supported Control Centre describe API', P.guideList, 'control_centre_list');
  parityTool('control_centre_add_attribute', 'Expose an attribute in the Control Centre', P.attribute);
  parityTool('control_centre_remove_attribute', 'Remove an attribute from the Control Centre', P.attribute);

  // Attribute UI, graph values, native beat timing, and persistent metadata.
  parityTool('attribute_limits_get', 'Read attribute definition limit overrides', P.attribute);
  parityTool('attribute_limits_set', 'Set hard/soft bounds and step overrides', P.limits);
  parityTool('attribute_limits_clear', 'Clear attribute definition limit overrides', P.attribute);
  parityTool('attribute_definition_get_effective', 'Read effective attribute definition after overrides', P.attribute);
  parityTool('graph_attribute_get', 'Read a Graph attribute value', P.attribute);
  parityTool('graph_attribute_set', 'Set a Graph attribute value', P.graphValue);
  parityTool('graph_attribute_apply_preset', 'Apply a native Graph attribute preset', P.graphPreset);
  parityTool('graph_attribute_flip_horizontal', 'Flip a Graph attribute horizontally', P.attribute, 'graph_attribute_flip', (args) => ({ ...args, direction: 'horizontal' }));
  parityTool('graph_attribute_flip_vertical', 'Flip a Graph attribute vertically', P.attribute, 'graph_attribute_flip', (args) => ({ ...args, direction: 'vertical' }));
  parityTool('beat_get_nth', 'Get the nth beat from active composition BPM settings', P.beat);
  parityTool('beat_generate_markers', 'Create Time Markers from a native beat range', P.beatRange);
  parityTool('metadata_set', 'Set native per-layer Cavalry User Data', P.metadata);
  parityTool('metadata_get', 'Get native per-layer Cavalry User Data', P.metadata);
  parityTool('metadata_has', 'Check native per-layer Cavalry User Data', P.metadata);
  parityTool('mcp_state_get', 'Read MCP-specific persistent Cavalry script state', P.keyValue);
  parityTool('mcp_state_set', 'Write MCP-specific persistent Cavalry script state', P.keyValue);
  parityTool('preferences_get', 'Read one explicit Cavalry preference', P.keyValue);
  parityTool('preferences_set', 'Explicitly set one global Cavalry preference', P.keyValue);
  parityTool('preferences_snapshot', 'Snapshot an explicit set of global Cavalry preference keys', P.preferenceKeys);
  parityTool('preferences_restore', 'Restore a previously captured explicit preference snapshot', P.preferenceValues);

  // Viewport, project, assets, render variants, and editor interoperability.
  parityTool('viewport_capture', 'Capture the actual Cavalry Viewport to an image', P.filePath);
  parityTool('viewport_active_tool', 'Read the active Viewport tool', {});
  parityTool('viewport_preferences_get', 'Snapshot explicit Viewport preference keys', P.preferenceKeys, 'preferences_snapshot');
  parityTool('viewport_preferences_set', 'Explicitly set one Viewport preference key', P.keyValue, 'preferences_set');
  parityTool('viewport_prepare_for_visual_qa', 'Apply explicit temporary Viewport preferences and return the exact previous values', P.viewportProfile, 'viewport_prepare');
  parityTool('viewport_restore', 'Restore exact Viewport preference values returned by viewport_prepare_for_visual_qa', P.preferenceValues, 'preferences_restore');
  parityTool('tool_get_active', 'Read the active Viewport tool', {}, 'viewport_active_tool');
  parityTool('project_get', 'Get project root and production paths', {});
  parityTool('project_paths', 'Get project root and production paths', {}, 'project_get');
  parityTool('project_set', 'Set a Cavalry Project root', P.projectSet);
  parityTool('project_clear', 'Clear the active Cavalry Project', {});
  parityTool('asset_group_create', 'Create an Asset Window group', P.assetGroup);
  parityTool('asset_sequence_inspect', 'Inspect image-sequence source paths', P.asset);
  parityTool('asset_google_sheet_inspect', 'Inspect Google Sheet asset state and URL', P.asset);
  parityTool('asset_google_sheet_replace', 'Replace a Google Sheet asset source', P.googleSheet);
  parityTool('asset_icc_profile', 'Inspect an asset ICC profile', P.asset);
  parityTool('color_asset_profile', 'Inspect an asset ICC profile', P.asset, 'asset_icc_profile');
  parityTool('asset_is_file', 'Check whether an asset is file-backed', P.asset);
  parityTool('asset_smart_folder_create', 'Create a Smart Folder asset', P.smartFolder);
  parityTool('asset_smart_folder_reload', 'Reload a Smart Folder asset after its source changes', P.asset, 'asset_reload');
  parityTool('render_dynamic_index_get', 'Read the Dynamic Rendering index', {});
  parityTool('render_dynamic_index_connect', 'Connect Dynamic Index to an attribute', P.dynamicConnect);
  parityTool('render_dynamic_range', 'Enable Dynamic Rendering and set its index range', P.dynamicRange);
  parityTool('render_dynamic_offset', 'Set the Dynamic Rendering index offset', P.dynamicOffset);
  parityTool('render_dynamic_preview', 'Report the missing native Dynamic preview API and direct callers to preview_frame', P.renderItem);
  parityTool('render_item_create', 'Create a first-class Render Queue Item for a composition', Schemas.RenderQueueSchemas.add, 'render_queue_add');
  parityTool('render_item_inspect', 'Inspect every exposed Render Queue Item attribute and value', P.renderItem);
  parityTool('render_item_attributes', 'List Render Queue Item attributes', P.renderItem);
  parityTool('render_item_set', 'Set arbitrary validated Render Queue Item attributes', P.renderItemSettings);
  parityTool('render_item_enable', 'Enable a Render Queue Item', P.renderItem, 'render_item_set', (args) => ({ ...args, settings: { selected: true } }));
  parityTool('render_item_disable', 'Disable a Render Queue Item', P.renderItem, 'render_item_set', (args) => ({ ...args, settings: { selected: false } }));
  parityTool('render_item_delete', 'Delete a Render Queue Item', P.renderItem);
  parityTool('render_item_duplicate', 'Duplicate a Render Queue Item', P.renderItem);
  parityTool('render_item_set_range', 'Set a custom Render Queue Item frame range', P.renderItemRange, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { frameRangeMode: 2, frameRange: { x: args.startFrame, y: args.endFrame } } }));
  parityTool('render_item_set_resolution_scale', 'Set Render Queue Item resolution percentage', P.renderItemScale, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { resolutionScale: args.scale } }));
  parityTool('render_item_set_quality', 'Set the native Render Queue Item quality enum', P.renderItemQuality, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { renderQuality: args.quality } }));
  parityTool('render_item_set_output', 'Set output path, file name, and optional installed format generator', P.renderItemOutput);
  parityTool('render_item_set_audio', 'Set codec-specific audio attributes on the active format generator', P.renderItemSettings, 'render_item_set_generator');
  parityTool('render_item_set_metadata', 'Replace Render Manager metadata entries', P.renderMetadata, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { metadata: args.metadata } }));
  parityTool('render_item_set_dynamic', 'Configure Dynamic Rendering attributes', P.renderItemSettings, 'render_item_set');
  parityTool('render_item_set_format', 'Set an installed render format generator such as renderMP4 or renderPNG', P.renderFormat);
  parityTool('render_script_get', 'Inspect setup, pre-render, and post-render scripts', P.renderItem, 'render_item_inspect');
  parityTool('render_script_set_setup', 'Set the Setup Render Script', P.renderScript, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { renderSetupExpression: args.script } }));
  parityTool('render_script_set_pre', 'Set the Pre-Render Script', P.renderScript, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { preRenderExpression: args.script } }));
  parityTool('render_script_set_post', 'Set the Post-Render Script', P.renderScript, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { postRenderExpression: args.script } }));
  parityTool('render_script_clear', 'Clear all three Render Queue Item scripts', P.renderItem, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { renderSetupExpression: '', preRenderExpression: '', postRenderExpression: '' } }));
  parityTool('render_metadata_enable', 'Enable Render Manager metadata output', P.renderItem, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { enableMetadata: true } }));
  parityTool('render_metadata_disable', 'Disable Render Manager metadata output', P.renderItem, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { enableMetadata: false } }));
  parityTool('render_metadata_add', 'Add or append a Render Manager metadata entry', P.renderMetadataEntry);
  parityTool('render_metadata_remove', 'Remove Render Manager metadata entries by name', P.renderMetadataEntry);
  parityTool('render_metadata_format', 'Set metadata format: 0 JSON, 1 Simple Traits, 2 NFT Traits', P.renderMetadataFormat, 'render_item_set', (args) => ({ itemId: args.itemId, settings: { metaDataFormat: args.format } }));
  parityTool('layer_get_supertypes', 'Read Cavalry layer supertypes', P.layer);
  parityTool('shape_has_fill', 'Check explicit shape fill state', P.layer);
  parityTool('shape_enable_fill', 'Enable shape fill', P.layer, 'shape_set_fill', (args) => ({ ...args, enabled: true }));
  parityTool('shape_disable_fill', 'Disable shape fill', P.layer, 'shape_set_fill', (args) => ({ ...args, enabled: false }));
  parityTool('shape_has_stroke', 'Check explicit shape stroke state', P.layer);
  parityTool('shape_enable_stroke', 'Enable shape stroke', P.layer, 'shape_set_stroke', (args) => ({ ...args, enabled: true }));
  parityTool('shape_disable_stroke', 'Disable shape stroke', P.layer, 'shape_set_stroke', (args) => ({ ...args, enabled: false }));
  for (const [name, action] of [['layer_bring_forward', 'forward'], ['layer_bring_to_front', 'front'], ['layer_send_backward', 'backward'], ['layer_send_to_back', 'back']] as const) {
    parityTool(name, `Move selected layers ${action}`, P.stack, 'layer_stack_action', (args) => ({ ...args, action }));
  }
  parityTool('scene_export_copy', 'Export a copy of the current Scene', P.filePath);
  parityTool('component_export_selected', 'Export selected connected layers as a Component', P.exportSelected);
  parityTool('clipboard_get_text', 'Read Cavalry clipboard text', {});
  parityTool('clipboard_set_text', 'Write Cavalry clipboard text', P.clipboard);

  // Stable semantic alternatives for native routes that can terminate or wedge
  // Cavalry 2.7.2.
  server.tool('path_morph_safe', 'Build an Editable Path morph as verified frame-sampled layers without native path keyframes', Schemas.SafeOperationSchemas.pathMorph.shape, handleTool('path_morph_safe', async (args) => Safe.pathMorphSafe(args.layerId, args.startFrame, args.endFrame, args.fromPath, args.toPath, args.sampleEvery)));
  server.tool('path_animation_safe', 'Build multi-keyframe Editable Path animation as a persistent sampled-layer sequence', Schemas.SafeOperationSchemas.pathAnimation.shape, handleTool('path_animation_safe', async (args) => Safe.pathAnimationSafe(args.layerId, args.keyframes, args.sampleEvery, args.namePrefix)));
  server.tool('camera_cut', 'Create a deterministic camera cut using hold keyframes on a normal Planar Camera', Schemas.SafeOperationSchemas.cameraCut.shape, handleTool('camera_cut', async (args) => Safe.cameraCut(args.layerId, args.shot)));
  server.tool('camera_transition', 'Create a camera move using ordinary Planar Camera transform keyframes and easing', Schemas.SafeOperationSchemas.cameraTransition.shape, handleTool('camera_transition', async (args) => Safe.cameraTransition(args.layerId, args.from, args.to, args.easing)));
  server.tool('camera_sequence_create', 'Create an ordered camera sequence without native Camera Guides', Schemas.SafeOperationSchemas.cameraSequence.shape, handleTool('camera_sequence_create', async (args) => Safe.cameraSequenceCreate(args.layerId, args.shots)));
  server.tool('timeline_preview_playback', 'Render an agent-safe low-resolution preview video instead of blocking the bridge with native playback', Schemas.PreviewSchemas.video.shape, handleTool('timeline_preview_playback', async (args) => Video.previewVideo(args.startFrame, args.endFrame, args.fps, args.scalePercentage, args.outputPath)));
  server.tool('render_mux_audio', 'Mux a Cavalry-rendered video with separately rendered audio and verify both streams with ffprobe', Schemas.SafeOperationSchemas.renderMuxAudio.shape, handleTool('render_mux_audio', async (args) => renderMuxAudio(args.videoPath, args.audioPath, args.outputPath)));

  // Optional macOS Accessibility driver. It is opt-in because these operations
  // focus windows, invoke menu commands, or interact with native dialogs.
  server.tool('ui_driver_status', 'Inspect optional Cavalry UI Driver availability and Accessibility permission', {}, handleTool('ui_driver_status', async () => UI.uiDriverStatus()));
  server.tool('command_search', 'Search real Cavalry menu commands without invoking them', Schemas.UiSchemas.commandSearch.shape, handleTool('command_search', async (args) => UI.commandSearch(args.query)));
  server.tool('command_execute', 'Interactively execute an exact Cavalry menu command', Schemas.UiSchemas.commandExecute.shape, handleTool('command_execute', async (args) => UI.commandExecute(args.command, args.menu)));
  server.tool('shortcut_discover', 'Discover visible Cavalry menu shortcuts and user overrides', Schemas.UiSchemas.shortcutDiscover.shape, handleTool('shortcut_discover', async (args) => UI.shortcutDiscover(args.query)));
  server.tool('shortcut_execute', 'Interactively send an explicit shortcut to the Cavalry Project window', Schemas.UiSchemas.shortcutExecute.shape, handleTool('shortcut_execute', async (args) => UI.shortcutExecute(args.key, args.modifiers)));
  server.tool('preferences_list', 'Enumerate preference keys from the active Cavalry profile without guessing key names', {}, handleTool('preferences_list', async () => UI.preferencesList()));
  server.tool('tool_set_active', 'Set a major Cavalry editor tool through the deterministic Tool menu', Schemas.UiSchemas.tool.shape, handleTool('tool_set_active', async (args) => UI.toolSetActive(args.tool)));
  server.tool('workspace_list', 'List Cavalry workspaces exposed by the Window menu', {}, handleTool('workspace_list', async () => UI.workspaceList()));
  server.tool('workspace_switch', 'Switch to a named Cavalry workspace through the Window menu', Schemas.UiSchemas.named.shape, handleTool('workspace_switch', async (args) => UI.workspaceSwitch(args.name)));
  server.tool('workspace_save', 'Save and verify a named Cavalry workspace as an explicitly interactive operation', Schemas.UiSchemas.workspaceSave.shape, handleTool('workspace_save', async (args) => UI.workspaceSave(args.name)));
  server.tool('workspace_reset', 'Reset the active Cavalry workspace through the Window menu', {}, handleTool('workspace_reset', async () => UI.workspaceReset()));
  server.tool('window_open', 'Open a named Cavalry editor window through the Window menu', Schemas.UiSchemas.named.shape, handleTool('window_open', async (args) => UI.windowOpen(args.name)));
  server.tool('window_close', 'Interactively close an exact Cavalry window title', Schemas.UiSchemas.window.shape, handleTool('window_close', async (args) => UI.windowClose(args.title)));
  server.tool('viewport_add', 'Add a Viewport through Cavalry Window commands', {}, handleTool('viewport_add', async () => UI.viewportAdd()));
  server.tool('focus_mode', 'Toggle Cavalry Focus Mode through the Window menu', {}, handleTool('focus_mode', async () => UI.focusMode()));
  server.tool('dialog_open_file', 'Report the native-dialog boundary and direct callers to verified scene_open', Schemas.UiSchemas.dialogPath.shape, handleTool('dialog_open_file', async () => UI.unsupportedUiCapability('native Open dialog automation', 'Use scene_open, which is deterministic and persistence-tested.')));
  server.tool('dialog_save_file', 'Report the native-dialog boundary and direct callers to verified scene_save_as', Schemas.UiSchemas.dialogPath.shape, handleTool('dialog_save_file', async () => UI.unsupportedUiCapability('native Save dialog automation', 'Use scene_save_as, which is deterministic and persistence-tested.')));
  server.tool('dialog_choose_folder', 'Report the native-dialog boundary and direct callers to verified project/file-path tools', Schemas.UiSchemas.dialogPath.shape, handleTool('dialog_choose_folder', async () => UI.unsupportedUiCapability('native folder chooser automation', 'Use project_set or an explicit absolute path.')));

  server.tool('preset_list', 'List the Cavalry preset library when the installed profile exposes it', {}, handleTool('preset_list', async () => UI.presetList()));
  server.tool('preset_apply', 'Apply a named preset through a discoverable Cavalry command when available', Schemas.UiSchemas.presetApply.shape, handleTool('preset_apply', async (args) => args.menu ? UI.commandExecute(args.name, args.menu) : UI.unsupportedUiCapability('generic preset application', 'Use command_search to locate a concrete preset command, then command_execute.')));
  for (const name of ['preset_save', 'preset_delete', 'preset_rename', 'preset_set_default', 'preset_clear_default'] as const) {
    server.tool(name, `${name} is classified explicitly when Cavalry exposes no stable generic preset mutation route`, Schemas.UiSchemas.presetFile.shape, handleTool(name, async () => UI.unsupportedUiCapability(name, 'Use the Upload Preset Manager interactively through window_open when applicable.')));
  }
  for (const name of ['tag_list', 'tag_create', 'tag_delete', 'tag_assign', 'tag_unassign', 'tag_select', 'tag_filter_scene', 'tag_filter_viewport', 'tag_clear_filter'] as const) {
    server.tool(name, `${name} reports the Cavalry 2.7.2 tag-control boundary without fabricating state`, Schemas.UiSchemas.tag.partial().shape, handleTool(name, async () => UI.unsupportedUiCapability(name, 'Tag display preferences remain available through preferences_get/preferences_set.')));
  }
  server.tool('third_party_ui_inspect', 'Report the generic Accessibility boundary for third-party custom plugin UI', Schemas.UiSchemas.window.shape, handleTool('third_party_ui_inspect', async (args) => UI.unsupportedUiCapability(`third-party controls in ${args.title}`, 'Use window_open plus command_search; plugin node attributes remain generically introspected.')));

  // ============================================================================
  // SCENE TOOLS
  // ============================================================================
  server.tool('scene_new', 'Create a new blank Cavalry scene', Schemas.SceneSchemas.new.shape, handleTool('scene_new', async (args) => Scene.sceneNew(args.force)));
  server.tool('scene_open', 'Open an existing Cavalry .cv scene file', Schemas.SceneSchemas.open.shape, handleTool('scene_open', async (args) => Scene.sceneOpen(args.path, args.force)));
  server.tool('scene_save', 'Save the current scene file in place', {}, handleTool('scene_save', async () => Scene.sceneSave()));
  server.tool('scene_save_as', 'Save the current scene to a specific .cv file path', Schemas.SceneSchemas.saveAs.shape, handleTool('scene_save_as', async (args) => Scene.sceneSaveAs(args.filePath)));
  server.tool('scene_has_unsaved_changes', 'Check if the active scene has unsaved changes', {}, handleTool('scene_has_unsaved_changes', async () => Scene.sceneHasUnsavedChanges()));
  server.tool('scene_import', 'Import a Cavalry scene (.cv) or component (.cvc) into the project', Schemas.SceneSchemas.import.shape, handleTool('scene_import', async (args) => Scene.sceneImport(args.path)));
  server.tool('scene_inspect', 'Inspect scene structure, active composition, layer counts, markers, and assets', Schemas.SceneSchemas.inspect.shape, handleTool('scene_inspect', async (args) => Scene.sceneInspect(args.detailed)));
  server.tool('scene_describe', 'Get an AI-friendly, token-efficient summary of the scene hierarchy', Schemas.SceneSchemas.describe.shape, handleTool('scene_describe', async (args) => Scene.sceneDescribe(args.compact)));
  server.tool('scene_checkpoint', 'Create a quick in-memory recovery checkpoint of the current scene state', {}, handleTool('scene_checkpoint', async () => Scene.sceneCheckpoint()));
  server.tool('scene_restore_checkpoint', 'Restore scene state from a checkpoint data string', Schemas.SceneSchemas.restoreCheckpoint.shape, handleTool('scene_restore_checkpoint', async (args) => Scene.sceneRestoreCheckpoint(args.data)));
  server.tool('scene_snapshot', 'Export a full serialization snapshot of all layers and connections in the scene', {}, handleTool('scene_snapshot', async () => Scene.sceneSnapshot()));
  server.tool('scene_diff', 'Compare two scene snapshot strings and compute added, removed, and modified elements', Schemas.SceneSchemas.diff.shape, handleTool('scene_diff', async (args) => Scene.computeSceneDiff(args.beforeSnapshot, args.afterSnapshot)));

  // ============================================================================
  // COMPOSITION TOOLS
  // ============================================================================
  server.tool('composition_list', 'List all compositions in the scene with active status', {}, handleTool('composition_list', async () => Comp.compositionList()));
  server.tool('composition_create', 'Create a new composition with resolution, fps, and frame range', Schemas.CompositionSchemas.create.shape, handleTool('composition_create', async (args) => Comp.compositionCreate(args)));
  server.tool('composition_get_active', 'Get details of the currently active composition', {}, handleTool('composition_get_active', async () => Comp.compositionGetActive()));
  server.tool('composition_set_active', 'Switch active composition in the editor', Schemas.CompositionSchemas.setActive.shape, handleTool('composition_set_active', async (args) => Comp.compositionSetActive(args.compId)));
  server.tool('composition_inspect', 'Inspect composition settings (resolution, fps, frame range, background color)', Schemas.CompositionSchemas.inspect.shape, handleTool('composition_inspect', async (args) => Comp.compositionInspect(args.compId)));
  server.tool('composition_update', 'Update composition resolution, frame rate, frame range, or background color', Schemas.CompositionSchemas.update.shape, handleTool('composition_update', async (args) => Comp.compositionUpdate(args)));
  server.tool('composition_precompose', 'Precompose selected layers into a new composition reference', Schemas.CompositionSchemas.precompose.shape, handleTool('composition_precompose', async (args) => Comp.compositionPrecompose(args.layerIds, args.name)));
  server.tool('composition_create_reference', 'Create a composition reference from an existing composition', Schemas.CompositionSchemas.createReference.shape, handleTool('composition_create_reference', async (args) => Comp.compositionCreateReference(args.compId)));
  server.tool('composition_add_override', 'Promote an attribute on a precomposed layer to an override', Schemas.CompositionSchemas.override.shape, handleTool('composition_add_override', async (args) => Comp.compositionAddOverride(args.layerId, args.attrPath)));
  server.tool('composition_remove_override', 'Remove an override attribute from a precomposition', Schemas.CompositionSchemas.override.shape, handleTool('composition_remove_override', async (args) => Comp.compositionRemoveOverride(args.layerId, args.attrPath)));
  server.tool('composition_list_overrides', 'List active overrides on a composition reference', Schemas.CompositionSchemas.listOverrides.shape, handleTool('composition_list_overrides', async (args) => Comp.compositionListOverrides(args.referenceId)));

  // ============================================================================
  // LAYER TOOLS
  // ============================================================================
  server.tool('layer_types', 'List all layer types discovered dynamically from the live Cavalry runtime', { includeExperimental: Schemas.z.boolean().optional() }, handleTool('layer_types', async (args) => Layer.layerTypes(args.includeExperimental)));
  server.tool('layer_create', 'Create a layer of any dynamically discovered Cavalry type', Schemas.LayerSchemas.create.shape, handleTool('layer_create', async (args) => Layer.layerCreate(args.layerType, args.name)));
  server.tool('layer_create_primitive', 'Create a primitive shape layer (rectangle, ellipse, star, polygon, line)', Schemas.LayerSchemas.createPrimitive.shape, handleTool('layer_create_primitive', async (args) => Layer.layerCreatePrimitive(args.primitiveType, args.name)));
  server.tool('layer_inspect', 'Inspect a layer including UUID, name, type, parent, in/out frame, and bounding box', Schemas.LayerSchemas.inspect.shape, handleTool('layer_inspect', async (args) => Layer.layerInspect(args.layerId, args.includeAttributes)));
  server.tool('layer_list', 'List layers in active composition or entire scene', Schemas.LayerSchemas.list.shape, handleTool('layer_list', async (args) => Layer.layerList(args.allScene, undefined, args.topLevelOnly)));
  server.tool('layer_list_by_type', 'List all layers of a specific type (e.g. textShape, duplicator)', Schemas.LayerSchemas.listByType.shape, handleTool('layer_list_by_type', async (args) => Layer.layerListByType(args.layerType)));
  server.tool('layer_find', 'Search layers by name, type, or regex pattern', Schemas.LayerSchemas.find.shape, handleTool('layer_find', async (args) => Layer.layerFind(args)));
  server.tool('layer_rename', 'Rename a layer', Schemas.LayerSchemas.rename.shape, handleTool('layer_rename', async (args) => Layer.layerRename(args.layerId, args.newName)));
  server.tool('layer_duplicate', 'Duplicate a layer', Schemas.LayerSchemas.duplicate.shape, handleTool('layer_duplicate', async (args) => Layer.layerDuplicate(args.layerId)));
  server.tool('layer_delete', 'Delete one or more layers by ID or UUID', Schemas.LayerSchemas.delete.shape, handleTool('layer_delete', async (args) => Layer.layerDelete(args.layerIds)));
  server.tool('layer_parent', 'Set parent-child hierarchy between layers', Schemas.LayerSchemas.parent.shape, handleTool('layer_parent', async (args) => Layer.layerParent(args.childLayerId, args.parentLayerId)));
  server.tool('layer_unparent', 'Un-parent a layer (move up one hierarchy level)', Schemas.LayerSchemas.unparent.shape, handleTool('layer_unparent', async (args) => Layer.layerUnparent(args.layerId)));
  server.tool('layer_children', 'Get all direct child layers', Schemas.LayerSchemas.inspect.shape, handleTool('layer_children', async (args) => Layer.layerChildren(args.layerId)));
  server.tool('layer_parent_info', 'Get parent layer information', Schemas.LayerSchemas.inspect.shape, handleTool('layer_parent_info', async (args) => Layer.layerParentInfo(args.layerId)));
  server.tool('layer_reorder', 'Reorder layer stack placement', Schemas.LayerSchemas.reorder.shape, handleTool('layer_reorder', async (args) => Layer.layerReorder(args.layerId, args.underLayerId)));
  server.tool('layer_select', 'Select layers in the editor', Schemas.LayerSchemas.select.shape, handleTool('layer_select', async (args) => Layer.layerSelect(args.layerIds)));
  server.tool('layer_get_selection', 'Get currently selected layers', { sortByHierarchy: Schemas.z.boolean().optional() }, handleTool('layer_get_selection', async (args) => Layer.layerGetSelection(args.sortByHierarchy)));
  server.tool('layer_bounding_box', 'Get geometry bounding box (x, y, width, height) of a layer', Schemas.LayerSchemas.boundingBox.shape, handleTool('layer_bounding_box', async (args) => Layer.layerBoundingBox(args.layerId, args.worldSpace)));
  server.tool('layer_set_in_frame', 'Set layer clip in-point frame', Schemas.LayerSchemas.setFrameRange.shape, handleTool('layer_set_in_frame', async (args) => Layer.layerSetInFrame(args.layerId, args.frame)));
  server.tool('layer_set_out_frame', 'Set layer clip out-point frame', Schemas.LayerSchemas.setFrameRange.shape, handleTool('layer_set_out_frame', async (args) => Layer.layerSetOutFrame(args.layerId, args.frame)));
  server.tool('layer_visibility', 'Get or set layer visibility', Schemas.LayerSchemas.visibility.shape, handleTool('layer_visibility', async (args) => Layer.layerVisibility(args.layerId, args.visible)));
  server.tool('layer_solo', 'Solo one layer, or clear all soloing when solo=false', Schemas.LayerSchemas.solo.shape, handleTool('layer_solo', async (args) => Layer.layerSolo(args.layerId, args.solo)));
  server.tool('layer_is_shape', 'Check if a layer contains vector shape geometry', Schemas.LayerSchemas.inspect.shape, handleTool('layer_is_shape', async (args) => Layer.layerIsShape(args.layerId)));

  // ============================================================================
  // ATTRIBUTE TOOLS
  // ============================================================================
  server.tool('attribute_list', 'List all available attribute paths on a layer', Schemas.AttributeSchemas.list.shape, handleTool('attribute_list', async (args) => Attr.attributeList(args.layerId)));
  server.tool('attribute_describe', 'Get rich metadata for an attribute: type, default, bounds, animatable, read-only status', Schemas.AttributeSchemas.describe.shape, handleTool('attribute_describe', async (args) => Attr.attributeDescribe(args.layerId, args.attrPath)));
  server.tool('attribute_get', 'Read the value of a specific attribute', Schemas.AttributeSchemas.get.shape, handleTool('attribute_get', async (args) => Attr.attributeGet(args.layerId, args.attrPath)));
  server.tool('attribute_get_many', 'Read multiple attribute values in a single call', Schemas.AttributeSchemas.getMany.shape, handleTool('attribute_get_many', async (args) => Attr.attributeGetMany(args.layerId, args.attrPaths)));
  server.tool('attribute_set', 'Set an attribute value on a layer', Schemas.AttributeSchemas.set.shape, handleTool('attribute_set', async (args) => Attr.attributeSet(args.layerId, args.attrPath, args.value)));
  server.tool('attribute_set_many', 'Set a dictionary of attributes on a layer', Schemas.AttributeSchemas.setMany.shape, handleTool('attribute_set_many', async (args) => Attr.attributeSetMany(args.layerId, args.attributes)));
  server.tool('attribute_reset', 'Reset an attribute to its default value', Schemas.AttributeSchemas.reset.shape, handleTool('attribute_reset', async (args) => Attr.attributeReset(args.layerId, args.attrPath)));
  server.tool('attribute_exists', 'Check if an attribute path exists on a layer', Schemas.AttributeSchemas.exists.shape, handleTool('attribute_exists', async (args) => Attr.attributeExists(args.layerId, args.attrPath)));
  server.tool('attribute_add_dynamic', 'Add a dynamic attribute to a supported layer (e.g. JavaScript layer)', Schemas.AttributeSchemas.addDynamic.shape, handleTool('attribute_add_dynamic', async (args) => Attr.attributeAddDynamic(args.layerId, args.attrId, args.attrType)));
  server.tool('attribute_remove_dynamic', 'Remove a dynamic attribute by path', Schemas.AttributeSchemas.arrayRemove.shape, handleTool('attribute_remove_dynamic', async (args) => Attr.attributeRemoveDynamic(args.layerId, args.attrPath)));
  server.tool('attribute_array_add', 'Append a new child item to an array attribute', Schemas.AttributeSchemas.arrayAdd.shape, handleTool('attribute_array_add', async (args) => Attr.attributeArrayAdd(args.layerId, args.attrId)));
  server.tool('attribute_array_remove', 'Remove an item from an array attribute by path', Schemas.AttributeSchemas.arrayRemove.shape, handleTool('attribute_array_remove', async (args) => Attr.attributeArrayRemove(args.layerId, args.attrPath)));
  server.tool('attribute_array_reorder', 'Reorder items within an array attribute', Schemas.AttributeSchemas.arrayReorder.shape, handleTool('attribute_array_reorder', async (args) => Attr.attributeArrayReorder(args.layerId, args.attrId, args.fromIndex, args.toIndex)));
  server.tool('attribute_expression_get', 'Read an attribute expression', Schemas.AttributeSchemas.describe.shape, handleTool('attribute_expression_get', async (args) => Attr.attributeExpressionGet(args.layerId, args.attrPath)));
  server.tool('attribute_expression_set', 'Set a procedural math expression on an attribute (e.g. "*2", "+50")', Schemas.AttributeSchemas.expression.shape, handleTool('attribute_expression_set', async (args) => Attr.attributeExpressionSet(args.layerId, args.attrPath, args.expression)));
  server.tool('attribute_expression_remove', 'Remove an expression from an attribute', Schemas.AttributeSchemas.describe.shape, handleTool('attribute_expression_remove', async (args) => Attr.attributeExpressionRemove(args.layerId, args.attrPath)));

  // ============================================================================
  // PROCEDURAL GRAPH TOOLS
  // ============================================================================
  server.tool('graph_connect', 'Wire an output attribute to an input attribute between layers', Schemas.GraphSchemas.connect.shape, handleTool('graph_connect', async (args) => Graph.graphConnect(args)));
  server.tool('graph_disconnect', 'Disconnect a specific attribute wire between layers', Schemas.GraphSchemas.disconnect.shape, handleTool('graph_disconnect', async (args) => Graph.graphDisconnect(args)));
  server.tool('graph_disconnect_input', 'Disconnect any input wire attached to an attribute', Schemas.GraphSchemas.disconnectInput.shape, handleTool('graph_disconnect_input', async (args) => Graph.graphDisconnectInput(args.layerId, args.attrPath)));
  server.tool('graph_disconnect_outputs', 'Disconnect all output wires branching from an attribute', Schemas.GraphSchemas.disconnectOutputs.shape, handleTool('graph_disconnect_outputs', async (args) => Graph.graphDisconnectOutputs(args.layerId, args.attrPath)));
  server.tool('graph_inputs', 'List all incoming connection wires attached to a layer', Schemas.GraphSchemas.inspect.shape, handleTool('graph_inputs', async (args) => Graph.graphInputs(args.layerId)));
  server.tool('graph_outputs', 'List all outgoing connection wires from a layer', Schemas.GraphSchemas.inspect.shape, handleTool('graph_outputs', async (args) => Graph.graphOutputs(args.layerId)));
  server.tool('graph_inspect', 'Inspect all input and output connections for a layer', Schemas.GraphSchemas.inspect.shape, handleTool('graph_inspect', async (args) => Graph.graphInspect(args.layerId)));
  server.tool('graph_validate_connection', 'Validate attribute compatibility before making a connection', Schemas.GraphSchemas.validate.shape, handleTool('graph_validate_connection', async (args) => Graph.graphValidateConnection(args)));

  // ============================================================================
  // GENERATOR TOOLS
  // ============================================================================
  server.tool('generator_list', 'List generator slots on a layer and their current types', Schemas.GeneratorSchemas.list.shape, handleTool('generator_list', async (args) => Gen.generatorList(args.layerId)));
  server.tool('generator_current', 'Get the current generator type for a layer slot', Schemas.GeneratorSchemas.get.shape, handleTool('generator_current', async (args) => Gen.generatorCurrent(args.layerId, args.generatorSlot)));
  server.tool('generator_set', 'Switch a generator on a layer (e.g. change basicShape from rectangle to ellipse)', Schemas.GeneratorSchemas.set.shape, handleTool('generator_set', async (args) => Gen.generatorSet(args.layerId, args.generatorType, args.generatorSlot)));
  server.tool('generator_describe', 'Describe the current generator on a layer', Schemas.GeneratorSchemas.get.shape, handleTool('generator_describe', async (args) => Gen.generatorDescribe(args.layerId, args.generatorSlot)));

  // ============================================================================
  // TIMELINE & ANIMATION TOOLS
  // ============================================================================
  server.tool('timeline_get_frame', 'Get the current timeline playhead frame number', {}, handleTool('timeline_get_frame', async () => Anim.timelineGetFrame()));
  server.tool('timeline_set_frame', 'Move the timeline playhead to a specific frame', Schemas.AnimationSchemas.setFrame.shape, handleTool('timeline_set_frame', async (args) => Anim.timelineSetFrame(args.frame)));
  server.tool('timeline_play', 'Start timeline playback in Cavalry', {}, handleTool('timeline_play', async () => Anim.timelinePlay()));
  server.tool('timeline_stop', 'Stop timeline playback in Cavalry', {}, handleTool('timeline_stop', async () => Anim.timelineStop()));
  server.tool('keyframe_list', 'List all frame numbers with keyframes on an attribute', Schemas.AnimationSchemas.keyframes.shape, handleTool('keyframe_list', async (args) => Anim.keyframeList(args.layerId, args.attrPath)));
  server.tool('keyframe_create', 'Set a keyframe on a layer attribute at a specific frame', Schemas.AnimationSchemas.createKeyframe.shape, handleTool('keyframe_create', async (args) => Anim.keyframeCreate(args.layerId, args.attrPath, args.frame, args.value)));
  server.tool('keyframe_update', 'Modify the value of an existing keyframe', Schemas.AnimationSchemas.updateKeyframe.shape, handleTool('keyframe_update', async (args) => Anim.keyframeUpdate(args.layerId, args.attrPath, args.frame, args.newValue)));
  server.tool('keyframe_move', 'Move a keyframe to a new frame number', Schemas.AnimationSchemas.moveKeyframe.shape, handleTool('keyframe_move', async (args) => Anim.keyframeMove(args.layerId, args.attrPath, args.fromFrame, args.toFrame)));
  server.tool('keyframe_delete', 'Delete a keyframe at a specific frame', Schemas.AnimationSchemas.deleteKeyframe.shape, handleTool('keyframe_delete', async (args) => Anim.keyframeDelete(args.layerId, args.attrPath, args.frame)));
  server.tool('keyframe_delete_animation', 'Remove all keyframes on an attribute', Schemas.AnimationSchemas.keyframes.shape, handleTool('keyframe_delete_animation', async (args) => Anim.keyframeDeleteAnimation(args.layerId, args.attrPath)));
  server.tool('keyframe_set_interpolation', 'Set keyframe interpolation mode: 0 = Bezier, 1 = Linear, 2 = Step', Schemas.AnimationSchemas.setInterpolation.shape, handleTool('keyframe_set_interpolation', async (args) => Anim.keyframeSetInterpolation(args.layerId, args.attrPath, args.frame, args.type)));
  server.tool('keyframe_set_tangents', 'Set exact Bezier curve tangents: angle, weight, angleLocked, weightLocked, coordinates', Schemas.AnimationSchemas.setTangents.shape, handleTool('keyframe_set_tangents', async (args) => Anim.keyframeSetTangents(args.layerId, args.attrPath, args)));
  server.tool('keyframe_set_velocity', 'Set incoming and outgoing speed and influence on a keyframe curve', Schemas.AnimationSchemas.setVelocity.shape, handleTool('keyframe_set_velocity', async (args) => Anim.keyframeSetVelocity(args.layerId, args.attrPath, args)));
  server.tool('keyframe_clear_velocity', 'Reset velocity speed and influence on a keyframe', Schemas.AnimationSchemas.clearVelocity.shape, handleTool('keyframe_clear_velocity', async (args) => Anim.keyframeClearVelocity(args.layerId, args.attrPath, args.frame)));
  server.tool('keyframe_magic_easing', 'Apply a supported Cavalry Magic Easing preset such as SlowOut, SpringOut, OvershootOut, or BounceOut', Schemas.AnimationSchemas.magicEasing.shape, handleTool('keyframe_magic_easing', async (args) => Anim.keyframeMagicEasing(args.layerId, args.attrPath, args.frame, args.easingType)));

  // ============================================================================
  // MOTION PRESET HELPERS
  // ============================================================================
  server.tool('motion_fade_in', 'Apply a fade-in animation preset using opacity keyframes and easing', Schemas.MotionPresetSchemas.fadeIn.shape, handleTool('motion_fade_in', async (args) => Motion.motionFadeIn(args.layerId, args.startFrame, args.duration, args.easing)));
  server.tool('motion_fade_out', 'Apply a fade-out animation preset', Schemas.MotionPresetSchemas.fadeOut.shape, handleTool('motion_fade_out', async (args) => Motion.motionFadeOut(args.layerId, args.startFrame, args.duration, args.easing)));
  server.tool('motion_slide', 'Apply a slide-in animation preset with position offset and custom easing', Schemas.MotionPresetSchemas.slide.shape, handleTool('motion_slide', async (args) => Motion.motionSlide(args.layerId, args.startFrame, args.duration, args.deltaX, args.deltaY, args.easing)));
  server.tool('motion_scale', 'Apply a scale animation preset (e.g. 0 to 1) with custom easing', Schemas.MotionPresetSchemas.scale.shape, handleTool('motion_scale', async (args) => Motion.motionScale(args.layerId, args.startFrame, args.duration, args.fromScale, args.toScale, args.easing)));
  server.tool('motion_pop', 'Apply a pop / overshoot scale entrance animation', Schemas.MotionPresetSchemas.pop.shape, handleTool('motion_pop', async (args) => Motion.motionPop(args.layerId, args.startFrame, args.duration)));
  server.tool('motion_bounce', 'Apply a bounce drop animation preset using native BounceOut easing', Schemas.MotionPresetSchemas.bounce.shape, handleTool('motion_bounce', async (args) => Motion.motionBounce(args.layerId, args.startFrame, args.duration, args.height)));

  // ============================================================================
  // TYPOGRAPHY TOOLS
  // ============================================================================
  server.tool('text_create', 'Create and style a text layer (font, size, color, tracking, alignment)', Schemas.TypographySchemas.create.shape, handleTool('text_create', async (args) => Typo.textCreate(args)));
  server.tool('text_set_content', 'Update text content string on a text layer', Schemas.TypographySchemas.setContent.shape, handleTool('text_set_content', async (args) => Typo.textSetContent(args.layerId, args.text)));
  server.tool('text_set_font', 'Set font family and style on a text layer', Schemas.TypographySchemas.setFont.shape, handleTool('text_set_font', async (args) => Typo.textSetFont(args.layerId, args.fontFamily, args.fontStyle)));
  server.tool('text_set_font_size', 'Set font point size on a text layer', Schemas.TypographySchemas.setFontSize.shape, handleTool('text_set_font_size', async (args) => Typo.textSetFontSize(args.layerId, args.fontSize)));
  server.tool('text_animate_characters', 'Build procedural per-character animation with subMesh and stagger', Schemas.TypographySchemas.animateChars.shape, handleTool('text_animate_characters', async (args) => Typo.textAnimateCharacters(args.layerId, args.startFrame, args.duration, args.staggerFrames)));
  server.tool('text_animate_words', 'Build procedural per-word entrance animation', Schemas.TypographySchemas.animateWords.shape, handleTool('text_animate_words', async (args) => Typo.textAnimateWords(args.layerId, args.startFrame, args.duration, args.staggerFrames)));
  server.tool('font_list', 'Discover installed fonts on the host machine', {}, handleTool('font_list', async () => Typo.listInstalledFonts()));
  server.tool('font_check', 'Check if a specific font family is installed', Schemas.TypographySchemas.fontCheck.shape, handleTool('font_check', async (args) => Typo.checkFontExists(args.fontFamily)));

  // ============================================================================
  // PATH & VECTOR GEOMETRY TOOLS
  // ============================================================================
  server.tool('path_create', 'Create an editable path shape layer from a primitive or points array', Schemas.PathSchemas.create.shape, handleTool('path_create', async (args) => Path.pathCreate(args.primitiveType, args.name, args.pathObject)));
  server.tool('path_inspect', 'Read editable path contours, points, and Bezier handles', Schemas.PathSchemas.inspect.shape, handleTool('path_inspect', async (args) => Path.pathInspect(args.layerId, args.worldSpace)));
  server.tool('path_set_points', 'Set points, handles, and closed state on an editable shape', Schemas.PathSchemas.setPoints.shape, handleTool('path_set_points', async (args) => Path.pathSetPoints(args.layerId, args.pathObject, args.worldSpace)));
  server.tool('shape_centre_pivot', 'Center the transform pivot of a shape layer', Schemas.PathSchemas.centrePivot.shape, handleTool('shape_centre_pivot', async (args) => Path.shapeCentrePivot(args.layerId, args.doCentroid)));
  server.tool('svg_convert_to_layers', 'Convert an SVG file directly into native editable Cavalry geometry layers', Schemas.PathSchemas.svgToLayers.shape, handleTool('svg_convert_to_layers', async (args) => Path.svgConvertToLayers(args.filePath)));

  // ============================================================================
  // ASSET TOOLS
  // ============================================================================
  server.tool('asset_list', 'List all items in the Cavalry Assets window', { topLevelOnly: Schemas.z.boolean().optional() }, handleTool('asset_list', async (args) => Asset.assetList(args.topLevelOnly)));
  server.tool('asset_inspect', 'Inspect asset properties, type, and source file path', Schemas.AssetSchemas.inspect.shape, handleTool('asset_inspect', async (args) => Asset.assetInspect(args.assetId)));
  server.tool('asset_import', 'Import an external file asset (PNG, JPG, SVG, MP4, MOV, WAV, etc.)', Schemas.AssetSchemas.import.shape, handleTool('asset_import', async (args) => Asset.assetImport(args.filePath, args.isSequence)));
  server.tool('asset_reload', 'Reload an asset from disk', Schemas.AssetSchemas.inspect.shape, handleTool('asset_reload', async (args) => Asset.assetReload(args.assetId)));
  server.tool('asset_replace', 'Replace an asset file with a new path', Schemas.AssetSchemas.replace.shape, handleTool('asset_replace', async (args) => Asset.assetReplace(args.assetId, args.newPath)));
  server.tool('asset_delete', 'Delete an asset from the project', Schemas.AssetSchemas.delete.shape, handleTool('asset_delete', async (args) => Asset.assetDelete(args.assetId)));
  server.tool('asset_add_to_composition', 'Place an asset footage layer into the active composition', Schemas.AssetSchemas.addToComp.shape, handleTool('asset_add_to_composition', async (args) => Asset.assetAddToComposition(args.assetId)));

  // ============================================================================
  // AUDIO TOOLS
  // ============================================================================
  server.tool('audio_import', 'Import an audio file into the project', Schemas.AudioSchemas.import.shape, handleTool('audio_import', async (args) => Audio.audioImport(args.filePath)));
  server.tool('audio_add_to_composition', 'Add an audio asset as a footage track in the composition', Schemas.AudioSchemas.addToComp.shape, handleTool('audio_add_to_composition', async (args) => Audio.audioAddToComposition(args.assetId)));
  server.tool('audio_inspect', 'Inspect audio asset or footage layer properties', Schemas.AssetSchemas.inspect.shape, handleTool('audio_inspect', async (args) => Audio.audioInspect(args.assetId)));
  server.tool('audio_set_offset', 'Set timeline start frame offset on an audio layer', Schemas.AudioSchemas.setOffset.shape, handleTool('audio_set_offset', async (args) => Audio.audioSetOffset(args.footageLayerId, args.frameOffset)));
  server.tool('audio_set_in_out', 'Set in-point and out-point clipping on an audio layer', Schemas.AudioSchemas.setInOut.shape, handleTool('audio_set_in_out', async (args) => Audio.audioSetInOut(args.footageLayerId, args.inFrame, args.outFrame)));
  server.tool('audio_set_volume', 'Set volume on an audio footage layer (0.0 to 1.0)', Schemas.AudioSchemas.setVolume.shape, handleTool('audio_set_volume', async (args) => Audio.audioSetVolume(args.footageLayerId, args.volume)));
  server.tool('audio_probe', 'Inspect audio file duration, sample rate, channels using local system utilities', Schemas.AudioSchemas.probe.shape, handleTool('audio_probe', async (args) => audioProbe(args.filePath)));

  // ============================================================================
  // TIME MARKER TOOLS
  // ============================================================================
  server.tool('marker_list', 'List all time markers on the active composition timeline', {}, handleTool('marker_list', async () => Marker.markerList()));
  server.tool('marker_create', 'Create a time marker on the timeline (e.g. for audio cues or beat sync)', Schemas.MarkerSchemas.create.shape, handleTool('marker_create', async (args) => Marker.markerCreate(args.frame, args.label, args.color)));
  server.tool('marker_update', 'Update a time marker label, color, or position', Schemas.MarkerSchemas.update.shape, handleTool('marker_update', async (args) => Marker.markerUpdate(args.markerId, args)));
  server.tool('marker_move', 'Move a time marker to a different frame', Schemas.MarkerSchemas.move.shape, handleTool('marker_move', async (args) => Marker.markerMove(args.markerId, args.frame)));
  server.tool('marker_delete', 'Delete a time marker', Schemas.MarkerSchemas.delete.shape, handleTool('marker_delete', async (args) => Marker.markerDelete(args.markerId)));

  // ============================================================================
  // SERIALIZATION & TEMPLATES
  // ============================================================================
  server.tool('layers_serialize', 'Export a network of layers and connections as a JSON string', Schemas.SerializationSchemas.serialize.shape, handleTool('layers_serialize', async (args) => Serial.layersSerialize(args.layerIds, args.withConnections)));
  server.tool('layers_deserialize', 'Instantiate a serialized layer network JSON string into the scene', Schemas.SerializationSchemas.deserialize.shape, handleTool('layers_deserialize', async (args) => Serial.layersDeserialize(args.jsonString)));
  server.tool('component_export', 'Export selected layers as a reusable .cvc component file', Schemas.SerializationSchemas.componentExport.shape, handleTool('component_export', async (args) => Serial.componentExport(args.filePath)));
  server.tool('component_import', 'Import a .cvc component file into the active scene', Schemas.SerializationSchemas.componentImport.shape, handleTool('component_import', async (args) => Serial.componentImport(args.filePath)));
  server.tool('template_create', 'Save a reusable motion template to disk', Schemas.SerializationSchemas.templateCreate.shape, handleTool('template_create', async (args) => Serial.templateCreate(args.name, args.layerIds, args.storagePath)));
  server.tool('template_instantiate', 'Instantiate a saved motion template from disk into the scene', Schemas.SerializationSchemas.templateInstantiate.shape, handleTool('template_instantiate', async (args) => Serial.templateInstantiate(args.templatePath)));

  // ============================================================================
  // PREVIEW & VISUAL EVALUATION TOOLS
  // ============================================================================
  server.tool('preview_frame', 'Render a specific frame as PNG to visually evaluate scene results', Schemas.PreviewSchemas.frame.shape, handleTool('preview_frame', async (args) => Preview.previewFrame(args.frame, args.scalePercentage, args.outputPath)));
  server.tool('preview_frames', 'Render a list of frames as PNG files for visual sequence review', Schemas.PreviewSchemas.frames.shape, handleTool('preview_frames', async (args) => Preview.previewFrames(args.frames, args.scalePercentage, args.outputDir)));
  server.tool('preview_contact_sheet', 'Render key timeline frames and synthesize a tiled contact sheet for AI visual evaluation', Schemas.PreviewSchemas.contactSheet.shape, handleTool('preview_contact_sheet', async (args) => ContactSheet.generateContactSheet(args.frames, args.columns, args.scalePercentage, args.outputPath)));
  server.tool('preview_video', 'Render a preview frame sequence and compile a lightweight preview video (MP4)', Schemas.PreviewSchemas.video.shape, handleTool('preview_video', async (args) => Video.previewVideo(args.startFrame, args.endFrame, args.fps, args.scalePercentage, args.outputPath)));

  // ============================================================================
  // RENDER MANAGER TOOLS
  // ============================================================================
  server.tool('render_queue_list', 'List items in the Cavalry Render Manager queue', {}, handleTool('render_queue_list', async () => Render.renderQueueList()));
  server.tool('render_queue_add', 'Add a composition to the Render Manager queue', Schemas.RenderQueueSchemas.add.shape, handleTool('render_queue_add', async (args) => Render.renderQueueAdd(args.compId)));
  server.tool('render_queue_configure', 'Configure output path, format, and render settings on a queue item', Schemas.RenderQueueSchemas.configure.shape, handleTool('render_queue_configure', async (args) => Render.renderQueueConfigure(args.itemId, args.settings)));
  server.tool('render_start', 'Start rendering a specific Render Manager item', Schemas.RenderQueueSchemas.start.shape, handleTool('render_start', async (args) => Render.renderStart(args.itemId)));
  server.tool('render_start_all', 'Start rendering all items in the Render Manager queue', {}, handleTool('render_start_all', async () => Render.renderStartAll()));
  server.tool('render_cancel', 'Cancel the current render in progress', {}, handleTool('render_cancel', async () => Render.renderCancel()));
  server.tool('render_background_start', 'Start a background render and record the last state Cavalry exposes without fabricating progress', Schemas.RenderQueueSchemas.start.shape, handleTool('render_background_start', async (args) => Render.renderBackgroundStart(args.itemId)));
  server.tool('render_status', 'Return known MCP render state; progress is null when Cavalry exposes no reliable percentage', Schemas.RenderQueueSchemas.status.shape, handleTool('render_status', async (args) => Render.renderStatus(args.itemId)));
  server.tool('render_is_active', 'Return true, false, or null when active-render state cannot be known reliably', Schemas.RenderQueueSchemas.status.shape, handleTool('render_is_active', async (args) => Render.renderIsActive(args.itemId)));
  server.tool('render_wait', 'Return completion for tracked foreground renders or an explicit unknown state for unsupervisable background renders', Schemas.RenderQueueSchemas.start.shape, handleTool('render_wait', async (args) => Render.renderWait(args.itemId)));

  // ============================================================================
  // DESIGN & LAYOUT HELPERS
  // ============================================================================
  server.tool('design_center', 'Center a layer at (0, 0) in the active composition', Schemas.DesignSchemas.center.shape, handleTool('design_center', async (args) => Layout.designCenter(args.layerId)));
  server.tool('design_align', 'Align multiple layers along an axis (left, center, right, top, middle, bottom)', Schemas.DesignSchemas.align.shape, handleTool('design_align', async (args) => Layout.designAlign(args.layerIds, args.alignment)));
  server.tool('design_distribute', 'Distribute layers evenly along X or Y axis with specified spacing', Schemas.DesignSchemas.distribute.shape, handleTool('design_distribute', async (args) => Layout.designDistribute(args.layerIds, args.axis, args.spacing)));
  server.tool('design_create_background', 'Create a background solid shape matching composition resolution', Schemas.DesignSchemas.background.shape, handleTool('design_create_background', async (args) => Layout.designCreateBackground(args.color, args.name)));

  return server;
}
