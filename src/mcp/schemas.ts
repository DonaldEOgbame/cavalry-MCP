import { z } from 'zod';
export { z };

export const CommonSchemas = {
  layerIdOrUuid: z.string().describe('Layer ID (e.g. "textShape#1") or UUIDv4 (e.g. "4c0b4352-89f5-...")'),
  attrPath: z.string().describe('Attribute path using dot-notation, e.g. "position.x", "fontSize", "material.materialColor"'),
  frame: z.number().int().describe('Timeline frame number'),
  filePath: z.string().describe('Absolute filesystem file path'),
};

export const SystemSchemas = {
  rawScript: z.object({
    code: z.string().describe('Raw JavaScript code to evaluate in Cavalry (api, cavalry, ui namespaces are available)'),
  }),
  batch: z.object({
    operations: z.array(z.object({
      id: z.string().describe('Unique identifier for this batch operation step'),
      op: z.string().describe('Operation name (e.g. "layer_create", "attribute_set", "graph_connect")'),
      params: z.record(z.string(), z.unknown()).describe('Operation parameters. Can reference prior results via "$symbol" or "$symbol.property"'),
      saveAs: z.string().optional().describe('Symbol name to save this operation result as (e.g. "$headline")'),
    })).describe('Array of atomic batch operations to execute sequentially in fail-fast mode'),
    stopOnError: z.boolean().optional().default(true).describe('Whether execution should abort on the first failing step'),
    expectedRevision: z.number().int().nonnegative().optional().describe('Abort with EDIT_CONFLICT if native callbacks observed a newer scene revision'),
  }),
};

const KnowledgeSourceTypeSchema = z.enum([
  'runtime_introspection', 'official_api', 'official_docs', 'verified_script', 'acceptance_test',
  'real_scene', 'motion_recipe', 'component', 'failure', 'visual_outcome', 'motion_principle',
  'third_party', 'community',
]);

const KnowledgeScopeSchema = z.enum(['global', 'project', 'session']);
const KnowledgeModeSchema = z.enum(['compact', 'normal', 'detailed']);

const KnowledgeFiltersSchema = z.object({
  sourceTypes: z.array(KnowledgeSourceTypeSchema).optional(),
  scopes: z.array(KnowledgeScopeSchema).optional(),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
  layerTypes: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  verifiedOnly: z.boolean().optional(),
  cavalryVersion: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const KnowledgeSchemas = {
  search: z.object({
    query: z.string().min(1),
    filters: KnowledgeFiltersSchema.optional(),
    mode: KnowledgeModeSchema.optional().default('normal'),
    liveRuntime: z.boolean().optional().default(false).describe('Query the connected Cavalry runtime instead of the local capability manifest'),
  }),
  concept: z.object({ concept: z.string().min(1), filters: KnowledgeFiltersSchema.optional(), mode: KnowledgeModeSchema.optional().default('normal') }),
  description: z.object({ description: z.string().min(1), filters: KnowledgeFiltersSchema.optional(), mode: KnowledgeModeSchema.optional().default('normal') }),
  api: z.object({ name: z.string().min(1), filters: KnowledgeFiltersSchema.optional(), mode: KnowledgeModeSchema.optional().default('normal') }),
  layer: z.object({ layerType: z.string().min(1), filters: KnowledgeFiltersSchema.optional(), mode: KnowledgeModeSchema.optional().default('normal') }),
  filters: z.object({ filters: KnowledgeFiltersSchema.optional() }),
  plan: z.object({
    goal: z.string().min(1),
    currentSceneSummary: z.string().optional(),
    assets: z.array(z.string()).optional().default([]),
    liveRuntime: z.boolean().optional().default(false),
  }),
  failure: z.object({
    intent: z.string().min(1), approach: z.string().min(1), mcpOperation: z.string().optional(), error: z.string().min(1),
    category: z.string().optional(), cause: z.string().optional(), solution: z.string().min(1), verifiedReplacement: z.string().optional(),
    scope: KnowledgeScopeSchema.optional().default('project'), projectId: z.string().optional(), cavalryVersion: z.string().optional(),
  }),
  script: z.object({
    task: z.string().min(1), status: z.enum(['verified', 'unverified', 'deprecated', 'failed']), script: z.string().min(1),
    inputAssumptions: z.array(z.string()).optional(), errors: z.array(z.string()).optional(),
    validation: z.object({ passed: z.boolean(), checks: z.array(z.string()).optional() }).optional(),
    scope: KnowledgeScopeSchema.optional().default('project'), projectId: z.string().optional(), cavalryVersion: z.string().optional(),
  }),
  currentScene: z.object({
    name: z.string().min(1), scope: z.enum(['project', 'session']).optional().default('project'), projectId: z.string().optional(),
    sessionId: z.string().optional(), verified: z.boolean().optional().default(false),
  }),
  visualOutcome: z.object({
    intent: z.string().min(1), recipeUsed: z.string().optional(), previewFrames: z.array(z.string()).optional(),
    timing: z.record(z.string(), z.unknown()).optional(), attributes: z.record(z.string(), z.unknown()).optional(), notes: z.array(z.string()).optional(),
    qaPassed: z.boolean(), issues: z.array(z.object({ issue: z.string(), fix: z.string().optional() })).optional(),
    scope: z.enum(['project', 'session']).optional().default('project'), projectId: z.string().optional(), sessionId: z.string().optional(), cavalryVersion: z.string().optional(),
  }),
};

export const EventSchemas = {
  subscription: z.object({
    events: z.array(z.string()).optional().describe('Event names; omit to subscribe or unsubscribe the wildcard'),
  }),
  poll: z.object({
    limit: z.number().int().min(1).max(500).optional().default(100),
  }),
};

export const SceneSchemas = {
  new: z.object({
    force: z.boolean().optional().default(false).describe('Discard unsaved changes without prompting'),
  }),
  open: z.object({
    path: CommonSchemas.filePath.describe('Path to the .cv scene file to open'),
    force: z.boolean().optional().describe('If true, discards any unsaved changes in the current scene'),
  }),
  saveAs: z.object({
    filePath: CommonSchemas.filePath.describe('Destination path for saving the scene (.cv)'),
  }),
  import: z.object({
    path: CommonSchemas.filePath.describe('Path to the .cv or .cvc file to import'),
  }),
  inspect: z.object({
    detailed: z.boolean().optional().describe('If true, includes full connection wires and parent hierarchy'),
  }),
  describe: z.object({
    compact: z.boolean().optional().default(true).describe('If true, returns a concise summary for low token usage'),
  }),
  restoreCheckpoint: z.object({
    data: z.string().describe('Serialized scene data string returned by scene_checkpoint'),
  }),
  diff: z.object({
    beforeSnapshot: z.string().describe('Snapshot state string from before changes'),
    afterSnapshot: z.string().describe('Snapshot state string after changes'),
  }),
};

export const CompositionSchemas = {
  create: z.object({
    name: z.string().describe('Composition name'),
    width: z.number().int().positive().optional().default(1920).describe('Width in pixels'),
    height: z.number().int().positive().optional().default(1080).describe('Height in pixels'),
    fps: z.number().positive().optional().default(30).describe('Frame rate'),
    startFrame: z.number().int().optional().default(0).describe('Playback start frame'),
    endFrame: z.number().int().optional().default(149).describe('Playback end frame'),
    makeActive: z.boolean().optional().default(true).describe('Whether to set as the active open composition'),
  }),
  setActive: z.object({
    compId: z.string().describe('Composition ID or UUID to activate'),
  }),
  inspect: z.object({
    compId: z.string().optional().describe('Composition ID or UUID (defaults to active composition)'),
  }),
  update: z.object({
    compId: z.string().optional().describe('Composition ID or UUID (defaults to active composition)'),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    fps: z.number().positive().optional(),
    startFrame: z.number().int().optional(),
    endFrame: z.number().int().optional(),
    backgroundColor: z.any().optional().describe('Color hex or RGB object'),
  }),
  precompose: z.object({
    layerIds: z.array(CommonSchemas.layerIdOrUuid).describe('Array of layer IDs or UUIDs to precompose'),
    name: z.string().optional().default('Pre-Comp').describe('Name for the new composition reference'),
  }),
  createReference: z.object({
    compId: z.string().describe('Composition ID to reference into the active composition'),
  }),
  override: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  listOverrides: z.object({
    referenceId: CommonSchemas.layerIdOrUuid.describe('Composition reference layer ID'),
  }),
};

export const LayerSchemas = {
  create: z.object({
    layerType: z.string().describe('Any valid Cavalry layer type discovered from layer_types (e.g. "textShape", "basicShape", "duplicator", "noiseDeformer")'),
    name: z.string().optional().describe('Display name for the layer'),
  }),
  createPrimitive: z.object({
    primitiveType: z.string().describe('Primitive shape type (e.g. "rectangle", "ellipse", "star", "polygon")'),
    name: z.string().optional().describe('Display name for the primitive layer'),
  }),
  inspect: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    includeAttributes: z.boolean().optional().default(false).describe('If true, lists all attribute paths on the layer'),
  }),
  list: z.object({
    allScene: z.boolean().optional().default(false).describe('If true, returns all layers across the entire scene; otherwise active composition only'),
    topLevelOnly: z.boolean().optional().default(false).describe('If true, returns only root layers not parented under others'),
  }),
  listByType: z.object({
    layerType: z.string().describe('Layer type filter (e.g. "textShape", "basicShape")'),
  }),
  find: z.object({
    name: z.string().optional().describe('Substring match against layer name'),
    type: z.string().optional().describe('Match against layer type'),
    pattern: z.string().optional().describe('Regex pattern match against name or ID'),
  }),
  rename: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    newName: z.string().describe('New display name for the layer'),
  }),
  duplicate: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
  }),
  delete: z.object({
    layerIds: z.union([CommonSchemas.layerIdOrUuid, z.array(CommonSchemas.layerIdOrUuid)]).describe('Layer ID/UUID or array of layer IDs/UUIDs to delete'),
  }),
  parent: z.object({
    childLayerId: CommonSchemas.layerIdOrUuid.describe('Child layer ID or UUID'),
    parentLayerId: CommonSchemas.layerIdOrUuid.describe('Parent layer ID or UUID'),
  }),
  unparent: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
  }),
  reorder: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    underLayerId: CommonSchemas.layerIdOrUuid,
  }),
  select: z.object({
    layerIds: z.array(CommonSchemas.layerIdOrUuid).describe('Array of layer IDs/UUIDs to select in the editor'),
  }),
  boundingBox: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    worldSpace: z.boolean().optional().default(true).describe('If true, includes position/scale transformations in bounds calculation'),
  }),
  setFrameRange: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    frame: CommonSchemas.frame,
  }),
  visibility: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    visible: z.boolean().optional().describe('Set visibility state (true = visible, false = hidden)'),
  }),
  solo: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    solo: z.boolean().describe('True solos this layer exclusively; false clears all soloing'),
  }),
};

export const AttributeSchemas = {
  list: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
  }),
  describe: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  get: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  getMany: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPaths: z.array(CommonSchemas.attrPath),
  }),
  set: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath.describe('Target attribute path (e.g. "position.x", "fontSize", "material.materialColor")'),
    value: z.unknown().describe('Value to set'),
  }),
  setMany: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attributes: z.record(z.string(), z.unknown()).describe('Key-value map of attribute paths to values'),
  }),
  reset: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  exists: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  addDynamic: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrId: z.string().describe('Attribute container ID (typically "array")'),
    attrType: z.string().describe('Data type (e.g. "double", "string", "color", "bool", "int2", "double2")'),
  }),
  arrayAdd: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrId: z.string().describe('Array attribute ID (typically "array")'),
  }),
  arrayRemove: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath.describe('Full path of item to remove (e.g. "array.1")'),
  }),
  arrayReorder: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrId: z.string().describe('Array attribute ID'),
    fromIndex: z.number().int(),
    toIndex: z.number().int(),
  }),
  expression: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    expression: z.string().describe('Procedural expression string (e.g. "*2", "+100")'),
  }),
};

export const GraphSchemas = {
  connect: z.object({
    sourceLayerId: CommonSchemas.layerIdOrUuid,
    sourceAttr: z.string().describe('Source output attribute (use "id" for layer main output)'),
    targetLayerId: CommonSchemas.layerIdOrUuid,
    targetAttr: z.string().describe('Target input attribute'),
    force: z.boolean().optional().default(false).describe('If true, replaces any existing connection on the target attribute'),
  }),
  disconnect: z.object({
    sourceLayerId: CommonSchemas.layerIdOrUuid,
    sourceAttr: z.string(),
    targetLayerId: CommonSchemas.layerIdOrUuid,
    targetAttr: z.string(),
  }),
  disconnectInput: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  disconnectOutputs: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  inspect: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
  }),
  validate: z.object({
    sourceLayerId: CommonSchemas.layerIdOrUuid,
    sourceAttr: z.string(),
    targetLayerId: CommonSchemas.layerIdOrUuid,
    targetAttr: z.string(),
  }),
};

export const GeneratorSchemas = {
  list: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
  }),
  get: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    generatorSlot: z.string().optional().default('generator'),
  }),
  set: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    generatorType: z.string().describe('Generator type to switch to (e.g. "ellipse", "rectangle", "star", "circleDistribution", "gridDistribution")'),
    generatorSlot: z.string().optional().default('generator'),
  }),
};

export const AnimationSchemas = {
  setFrame: z.object({
    frame: CommonSchemas.frame,
  }),
  keyframes: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
  }),
  createKeyframe: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
    value: z.unknown().describe('Value to set at this keyframe'),
  }),
  updateKeyframe: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
    newValue: z.unknown().describe('New value for keyframe'),
  }),
  moveKeyframe: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    fromFrame: CommonSchemas.frame,
    toFrame: CommonSchemas.frame,
  }),
  deleteKeyframe: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
  }),
  setInterpolation: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
    type: z.union([z.literal(0), z.literal(1), z.literal(2)]).describe('Interpolation type: 0 = Bezier, 1 = Linear, 2 = Step'),
  }),
  setTangents: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
    inHandle: z.boolean().optional().describe('Whether in-handle is affected'),
    outHandle: z.boolean().optional().describe('Whether out-handle is affected'),
    angleLocked: z.boolean().optional(),
    weightLocked: z.boolean().optional(),
    angle: z.number().optional().describe('Tangent angle in degrees (0 is flat)'),
    weight: z.number().optional().describe('Tangent weight handle length'),
    xValue: z.number().optional().describe('Absolute frame X coordinate for handle'),
    yValue: z.number().optional().describe('Absolute value Y coordinate for handle'),
  }),
  setVelocity: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
    leftSpeed: z.number().optional().describe('Incoming speed (0.0 .. 2.0)'),
    rightSpeed: z.number().optional().describe('Outgoing speed'),
    leftInfluence: z.number().optional().describe('Incoming influence (0.01 .. 1.0)'),
    rightInfluence: z.number().optional().describe('Outgoing influence'),
  }),
  clearVelocity: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
  }),
  magicEasing: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    attrPath: CommonSchemas.attrPath,
    frame: CommonSchemas.frame,
    easingType: z.enum(['SlowIn', 'SlowOut', 'SlowInSlowOut', 'VerySlowIn', 'VerySlowOut', 'VerySlowInVerySlowOut', 'SpringIn', 'SpringOut', 'SpringInSpringOut', 'SmallSpringIn', 'SmallSpringOut', 'SmallSpringInSmallSpringOut', 'AnticipateIn', 'OvershootOut', 'AnticipateInOvershootOut', 'BounceIn', 'BounceOut', 'BounceInBounceOut', 'None']).describe('Cavalry Magic Easing preset name'),
  }),
};

export const MotionPresetSchemas = {
  fadeIn: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(20),
    easing: z.string().optional().default('SlowOut'),
  }),
  fadeOut: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(20),
    easing: z.string().optional().default('SlowIn'),
  }),
  slide: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(30),
    deltaX: z.number().optional().default(0),
    deltaY: z.number().optional().default(100),
    easing: z.string().optional().default('SlowOut'),
  }),
  scale: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(25),
    fromScale: z.number().optional().default(0),
    toScale: z.number().optional().default(1),
    easing: z.string().optional().default('SlowOut'),
  }),
  pop: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(30),
  }),
  bounce: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(40),
    height: z.number().optional().default(-150),
  }),
};

export const TypographySchemas = {
  create: z.object({
    text: z.string().describe('Text content to display'),
    fontFamily: z.string().optional().describe('Font family name (e.g. "Arial", "Inter", "Helvetica")'),
    fontStyle: z.string().optional().default('Regular').describe('Font style/weight (e.g. "Bold", "Regular", "Medium")'),
    fontSize: z.number().optional().default(64).describe('Font size in points'),
    color: z.string().optional().default('#ffffff').describe('Hex color string'),
    alignment: z.enum(['left', 'center', 'right']).optional().default('center'),
    tracking: z.number().optional().default(0).describe('Letter spacing / tracking'),
    lineSpacing: z.number().optional().default(0),
    name: z.string().optional().default('Text'),
  }),
  setContent: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    text: z.string(),
  }),
  setFont: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    fontFamily: z.string(),
    fontStyle: z.string().optional().default('Regular'),
  }),
  setFontSize: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    fontSize: z.number(),
  }),
  animateChars: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(30),
    staggerFrames: z.number().optional().default(2),
  }),
  animateWords: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    startFrame: CommonSchemas.frame,
    duration: z.number().int().optional().default(30),
    staggerFrames: z.number().optional().default(4),
  }),
  fontCheck: z.object({
    fontFamily: z.string().describe('Font family name to verify'),
  }),
};

export const PathSchemas = {
  create: z.object({
    primitiveType: z.string().optional().default('rectangle'),
    name: z.string().optional().default('Editable Shape'),
    pathObject: z.any().optional().describe('Editable contour array'),
  }),
  inspect: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    worldSpace: z.boolean().optional().default(false),
  }),
  setPoints: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    pathObject: z.any().describe('Array of contours with points, inHandles, outHandles, and isClosed'),
    worldSpace: z.boolean().optional().default(false),
  }),
  centrePivot: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    doCentroid: z.boolean().optional().default(false),
  }),
  svgToLayers: z.object({
    filePath: CommonSchemas.filePath.describe('Path to the SVG file to convert directly into native Cavalry layers'),
  }),
};

export const AssetSchemas = {
  inspect: z.object({
    assetId: z.string().describe('Asset ID from Asset Window'),
  }),
  import: z.object({
    filePath: CommonSchemas.filePath.describe('Path to asset file (PNG, JPG, SVG, MP4, MOV, WAV, MP3, etc.)'),
    isSequence: z.boolean().optional().default(false).describe('True if this is the start of an image sequence'),
  }),
  replace: z.object({
    assetId: z.string(),
    newPath: CommonSchemas.filePath,
  }),
  delete: z.object({
    assetId: z.string(),
  }),
  addToComp: z.object({
    assetId: z.string(),
  }),
};

export const AudioSchemas = {
  import: z.object({
    filePath: CommonSchemas.filePath.describe('Audio file path (WAV, MP3, AAC, AIFF)'),
  }),
  addToComp: z.object({
    assetId: z.string(),
  }),
  setOffset: z.object({
    footageLayerId: CommonSchemas.layerIdOrUuid,
    frameOffset: z.number().describe('Frame offset on timeline'),
  }),
  setInOut: z.object({
    footageLayerId: CommonSchemas.layerIdOrUuid,
    inFrame: CommonSchemas.frame,
    outFrame: CommonSchemas.frame,
  }),
  setVolume: z.object({
    footageLayerId: CommonSchemas.layerIdOrUuid,
    volume: z.number().describe('Volume (0.0 to 1.0)'),
  }),
  probe: z.object({
    filePath: CommonSchemas.filePath,
  }),
};

export const MarkerSchemas = {
  create: z.object({
    frame: CommonSchemas.frame,
    label: z.string().optional().describe('Marker note / text cue'),
    color: z.string().optional().describe('Marker color hex string'),
  }),
  update: z.object({
    markerId: z.string(),
    frame: CommonSchemas.frame.optional(),
    label: z.string().optional(),
    color: z.string().optional(),
  }),
  move: z.object({
    markerId: z.string(),
    frame: CommonSchemas.frame,
  }),
  delete: z.object({
    markerId: z.string(),
  }),
};

export const SerializationSchemas = {
  serialize: z.object({
    layerIds: z.array(CommonSchemas.layerIdOrUuid),
    withConnections: z.boolean().optional().default(true),
  }),
  deserialize: z.object({
    jsonString: z.string().describe('Serialized Cavalry layer network JSON string'),
  }),
  componentExport: z.object({
    filePath: CommonSchemas.filePath.describe('Destination .cvc component file path'),
  }),
  componentImport: z.object({
    filePath: CommonSchemas.filePath.describe('Path to .cvc component file to import'),
  }),
  templateCreate: z.object({
    name: z.string().describe('Template name (e.g. "kinetic-title", "lower-third")'),
    layerIds: z.array(CommonSchemas.layerIdOrUuid),
    storagePath: CommonSchemas.filePath,
  }),
  templateInstantiate: z.object({
    templatePath: CommonSchemas.filePath,
  }),
};

export const PreviewSchemas = {
  frame: z.object({
    frame: CommonSchemas.frame.optional().default(0),
    scalePercentage: z.number().int().min(10).max(200).optional().default(100).describe('Render scale percentage (e.g. 50, 100, 200)'),
    outputPath: CommonSchemas.filePath.optional().describe('Optional custom destination path for the rendered PNG'),
  }),
  frames: z.object({
    frames: z.array(CommonSchemas.frame).describe('List of frame numbers to render'),
    scalePercentage: z.number().int().optional().default(50),
    outputDir: CommonSchemas.filePath.optional(),
  }),
  contactSheet: z.object({
    frames: z.array(CommonSchemas.frame).describe('List of frame numbers to tile into contact sheet (e.g. [0, 15, 30, 45, 60])'),
    columns: z.number().int().optional().default(3).describe('Number of grid columns'),
    scalePercentage: z.number().int().optional().default(25).describe('Render scale percentage for thumbnails'),
    outputPath: CommonSchemas.filePath.optional(),
  }),
  video: z.object({
    startFrame: CommonSchemas.frame,
    endFrame: CommonSchemas.frame,
    fps: z.number().optional().default(30),
    scalePercentage: z.number().int().optional().default(50),
    outputPath: CommonSchemas.filePath.optional(),
  }),
};

export const RenderQueueSchemas = {
  add: z.object({
    compId: z.string().optional().describe('Composition ID (defaults to active composition)'),
  }),
  configure: z.object({
    itemId: z.string().describe('Render queue item ID'),
    settings: z.record(z.string(), z.unknown()).describe('Attributes to set on the render queue item (output path, format, frame range)'),
  }),
  start: z.object({
    itemId: z.string(),
  }),
};

export const DesignSchemas = {
  center: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
  }),
  align: z.object({
    layerIds: z.array(CommonSchemas.layerIdOrUuid),
    alignment: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']),
  }),
  distribute: z.object({
    layerIds: z.array(CommonSchemas.layerIdOrUuid),
    axis: z.enum(['x', 'y']).optional().default('x'),
    spacing: z.number().optional().default(50),
  }),
  background: z.object({
    color: z.string().optional().default('#121316'),
    name: z.string().optional().default('Background'),
  }),
};

// Schemas for desktop-parity operations backed by documented Cavalry APIs.
export const ParitySchemas = {
  layer: z.object({ layerId: CommonSchemas.layerIdOrUuid }),
  layerWorld: z.object({ layerId: CommonSchemas.layerIdOrUuid, worldSpace: z.boolean().optional().default(false) }),
  layersMove: z.object({ layerIds: z.array(CommonSchemas.layerIdOrUuid).min(1), x: z.number(), y: z.number() }),
  pivot: z.object({ layerId: CommonSchemas.layerIdOrUuid, centroid: z.boolean().optional().default(false), worldSpace: z.boolean().optional().default(false) }),
  attribute: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1) }),
  attributes: z.object({ attributePaths: z.array(z.string().min(1)), add: z.boolean().optional().default(false) }),
  keyframeIds: z.object({ keyframeIds: z.array(z.string()) }),
  keyframeId: z.object({ keyframeId: z.string().min(1) }),
  makeEditable: z.object({ layerId: CommonSchemas.layerIdOrUuid, makeCopy: z.boolean().optional().default(false) }),
  editablePath: z.object({ layerId: CommonSchemas.layerIdOrUuid, pathObject: z.any(), worldSpace: z.boolean().optional().default(false) }),
  pathSelection: z.object({
    layerId: CommonSchemas.layerIdOrUuid,
    points: z.array(z.object({ contourIndex: z.number().int().nonnegative(), pointIndex: z.number().int().nonnegative() })),
    add: z.boolean().optional().default(false),
    worldSpace: z.boolean().optional().default(false),
  }),
  pointMove: z.object({ layerId: CommonSchemas.layerIdOrUuid, x: z.number(), y: z.number(), localSpace: z.boolean().optional().default(true) }),
  pointPosition: z.object({ layerId: CommonSchemas.layerIdOrUuid, position: z.record(z.string(), z.number()), localSpace: z.boolean().optional().default(true), handles: z.boolean().optional().default(false) }),
  pathHandle: z.object({ layerId: CommonSchemas.layerIdOrUuid, contourIndex: z.number().int().nonnegative(), pointIndex: z.number().int().nonnegative(), handle: z.enum(['in', 'out']), position: z.object({ x: z.number(), y: z.number() }), worldSpace: z.boolean().optional().default(false) }),
  pathLocking: z.object({ layerId: CommonSchemas.layerIdOrUuid, contourIndex: z.number().int().nonnegative(), pointIndex: z.number().int().nonnegative(), angleLocked: z.boolean().optional(), weightLocked: z.boolean().optional(), worldSpace: z.boolean().optional().default(false) }),
  pathContourEdit: z.object({ layerId: CommonSchemas.layerIdOrUuid, action: z.enum(['addContour', 'removeContour', 'addPoint', 'removePoint', 'closeContour', 'openContour']).optional(), contourIndex: z.number().int().nonnegative().optional(), pointIndex: z.number().int().nonnegative().optional(), contour: z.any().optional(), point: z.any().optional(), worldSpace: z.boolean().optional().default(false) }),
  pathAddContour: z.object({ layerId: CommonSchemas.layerIdOrUuid, contour: z.any(), worldSpace: z.boolean().optional().default(false) }),
  pathContour: z.object({ layerId: CommonSchemas.layerIdOrUuid, contourIndex: z.number().int().nonnegative(), worldSpace: z.boolean().optional().default(false) }),
  pathAddPoint: z.object({ layerId: CommonSchemas.layerIdOrUuid, contourIndex: z.number().int().nonnegative(), pointIndex: z.number().int().nonnegative().optional(), point: z.any(), worldSpace: z.boolean().optional().default(false) }),
  pathPoint: z.object({ layerId: CommonSchemas.layerIdOrUuid, contourIndex: z.number().int().nonnegative(), pointIndex: z.number().int().nonnegative(), worldSpace: z.boolean().optional().default(false) }),
  pathKeyframeGet: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1), frame: CommonSchemas.frame }),
  pathKeyframeSet: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1), frame: CommonSchemas.frame, pathObject: z.any() }),
  pathMorph: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1), startFrame: CommonSchemas.frame, endFrame: CommonSchemas.frame, fromPath: z.any(), toPath: z.any() }),
  cameraCreate: z.object({ name: z.string().optional(), cameraType: z.number().int().min(0).max(2).optional() }),
  cameraType: z.object({ layerId: CommonSchemas.layerIdOrUuid, cameraType: z.number().int().min(0).max(2) }),
  cameraGuideCreate: z.object({ name: z.string().optional() }),
  cameraGuides: z.object({ layerId: CommonSchemas.layerIdOrUuid, guideIds: z.array(CommonSchemas.layerIdOrUuid) }),
  cameraGuide: z.object({ layerId: CommonSchemas.layerIdOrUuid, guideId: CommonSchemas.layerIdOrUuid }),
  cameraLookAt: z.object({ layerId: CommonSchemas.layerIdOrUuid, position: z.object({ x: z.number(), y: z.number(), z: z.number().optional() }) }),
  guideList: z.object({ compId: z.string().optional() }),
  guideCreate: z.object({ compId: z.string().optional(), position: z.number().int(), vertical: z.boolean().optional() }),
  guideDelete: z.object({ compId: z.string().optional(), guideId: z.number().int() }),
  guideMove: z.object({ compId: z.string().optional(), guideId: z.number().int(), position: z.number().int(), vertical: z.boolean() }),
  limits: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1), limits: z.object({ hardMin: z.number().optional(), hardMax: z.number().optional(), softMin: z.number().optional(), softMax: z.number().optional(), step: z.number().optional() }) }),
  graphValue: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1), value: z.any() }),
  graphPreset: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1), preset: z.enum(['s-curve', 'ramp', 'linear', 'flat']) }),
  graphFlip: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1), direction: z.enum(['horizontal', 'vertical']) }),
  beat: z.object({ beat: z.number().int() }),
  beatRange: z.object({ startBeat: z.number().int(), endBeat: z.number().int() }),
  metadata: z.object({ layerId: CommonSchemas.layerIdOrUuid, key: z.string().min(1), value: z.any().optional() }),
  keyValue: z.object({ key: z.string().min(1), value: z.any().optional() }),
  preferenceKeys: z.object({ keys: z.array(z.string().min(1)).min(1) }),
  preferenceValues: z.object({ values: z.record(z.string(), z.any()) }),
  viewportProfile: z.object({ profile: z.enum(['clean_preview', 'debug_geometry', 'show_drawables', 'high_quality', 'performance', 'shape_depth_debug', 'custom']).optional().default('custom'), settings: z.record(z.string(), z.any()).describe('Explicit Cavalry preference keys and temporary values') }),
  filePath: z.object({ filePath: CommonSchemas.filePath }),
  projectSet: z.object({ path: CommonSchemas.filePath }),
  assetGroup: z.object({ name: z.string().min(1) }),
  asset: z.object({ assetId: z.string().min(1) }),
  googleSheet: z.object({ assetId: z.string().min(1), spreadsheetId: z.string().min(1), sheetId: z.string().min(1) }),
  smartFolder: z.object({ path: CommonSchemas.filePath, assetType: z.string().min(1) }),
  dynamicConnect: z.object({ layerId: CommonSchemas.layerIdOrUuid, attrPath: z.string().min(1) }),
  dynamicOffset: z.object({ offset: z.number().int() }),
  dynamicRange: z.object({ itemId: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }),
  renderItem: z.object({ itemId: z.string().min(1) }),
  renderItemSettings: z.object({ itemId: z.string().min(1), settings: z.record(z.string(), z.unknown()) }),
  renderItemRange: z.object({ itemId: z.string().min(1), startFrame: CommonSchemas.frame, endFrame: CommonSchemas.frame }),
  renderItemScale: z.object({ itemId: z.string().min(1), scale: z.number().positive() }),
  renderItemQuality: z.object({ itemId: z.string().min(1), quality: z.number().int() }),
  renderItemOutput: z.object({ itemId: z.string().min(1), filePath: CommonSchemas.filePath, fileName: z.string().optional(), formatType: z.string().optional().describe('Installed render generator type, e.g. renderMP4 or renderPNG') }),
  renderScript: z.object({ itemId: z.string().min(1), script: z.string() }),
  renderMetadata: z.object({ itemId: z.string().min(1), metadata: z.array(z.object({ name: z.string(), value: z.any() })) }),
  renderMetadataEntry: z.object({ itemId: z.string().min(1), name: z.string().min(1), value: z.any().optional() }),
  renderMetadataFormat: z.object({ itemId: z.string().min(1), format: z.number().int().min(0).max(2) }),
  renderFormat: z.object({ itemId: z.string().min(1), formatType: z.string().min(1) }),
  enabled: z.object({ layerId: CommonSchemas.layerIdOrUuid, enabled: z.boolean() }),
  stack: z.object({ layerIds: z.array(CommonSchemas.layerIdOrUuid).min(1), action: z.enum(['forward', 'front', 'backward', 'back']).optional() }),
  exportSelected: z.object({ filePath: CommonSchemas.filePath, asProject: z.boolean().optional().default(false) }),
  clipboard: z.object({ text: z.string() }),
};
