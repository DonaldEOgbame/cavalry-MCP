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

  server.tool('cavalry_bridge_info', 'Get bridge connection metadata and host system information', {}, handleTool('cavalry_bridge_info', async () => {
    return getBridgeInfo();
  }));

  server.tool('cavalry_batch', 'Execute a sequential batch of operations in a single round-trip with "$symbol" reference resolution', Schemas.SystemSchemas.batch.shape, handleTool('cavalry_batch', async (args) => {
    return executeBatch(args);
  }));

  server.tool('cavalry_raw_script', 'Escape hatch to execute arbitrary JavaScript in Cavalry (disabled by default; requires CAVALRY_ALLOW_RAW_SCRIPT=true)', Schemas.SystemSchemas.rawScript.shape, handleTool('cavalry_raw_script', async (args) => {
    return executeRawScript(args.code);
  }));

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

  // ============================================================================
  // DESIGN & LAYOUT HELPERS
  // ============================================================================
  server.tool('design_center', 'Center a layer at (0, 0) in the active composition', Schemas.DesignSchemas.center.shape, handleTool('design_center', async (args) => Layout.designCenter(args.layerId)));
  server.tool('design_align', 'Align multiple layers along an axis (left, center, right, top, middle, bottom)', Schemas.DesignSchemas.align.shape, handleTool('design_align', async (args) => Layout.designAlign(args.layerIds, args.alignment)));
  server.tool('design_distribute', 'Distribute layers evenly along X or Y axis with specified spacing', Schemas.DesignSchemas.distribute.shape, handleTool('design_distribute', async (args) => Layout.designDistribute(args.layerIds, args.axis, args.spacing)));
  server.tool('design_create_background', 'Create a background solid shape matching composition resolution', Schemas.DesignSchemas.background.shape, handleTool('design_create_background', async (args) => Layout.designCreateBackground(args.color, args.name)));

  return server;
}
