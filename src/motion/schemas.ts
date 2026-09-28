import { z } from 'zod';
import { MOTION_PRIMITIVES } from './types.js';

const primitive = z.enum(MOTION_PRIMITIVES);
const transitionReference = z.union([primitive, z.object({ transitionId: z.string().min(1) })]);
const vector = z.object({ x: z.number(), y: z.number() });

const behavior = z.object({
  type: primitive,
  startFrame: z.number().int().nonnegative().optional(),
  durationFrames: z.number().int().positive().optional(),
  amount: z.number().optional(),
  from: z.union([z.number(), z.string()]).optional(),
  to: z.union([z.number(), z.string()]).optional(),
  easing: z.string().optional(),
});

const motionElementBaseSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['text', 'rectangle', 'ellipse', 'group']),
  name: z.string().optional(),
  text: z.string().optional(),
  style: z.string().optional(),
  parentId: z.string().optional(),
  position: vector.optional(),
  scale: z.union([z.number(), vector]).optional(),
  opacity: z.number().min(0).max(100).optional(),
  rotation: z.number().optional(),
  color: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  tracking: z.number().optional(),
  lineHeight: z.number().positive().optional(),
  motions: z.array(behavior).optional(),
});

export const motionElementSchema = motionElementBaseSchema.superRefine((value, ctx) => {
  if (value.kind === 'text' && value.text === undefined) ctx.addIssue({ code: 'custom', message: 'Text elements require text.' });
});

const scene = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  durationFrames: z.number().int().positive(),
  background: z.string().min(1),
  elements: z.array(motionElementSchema).min(1),
  transitionIn: transitionReference.optional(),
  transitionOut: transitionReference.optional(),
});

export const typographyStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontStyle: z.string().optional(),
  fontSize: z.number().positive(),
  color: z.string().optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  tracking: z.number().optional(),
  lineHeight: z.number().positive().optional(),
});

export const motionProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  resolution: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  fps: z.number().positive(),
  designTokens: z.object({
    colors: z.record(z.string(), z.string()).optional(),
    spacing: z.record(z.string(), z.number()).optional(),
    typographyScale: z.record(z.string(), z.number()).optional(),
  }).optional(),
  typographyStyles: z.record(z.string(), typographyStyleSchema).optional(),
  components: z.record(z.string(), z.object({ id: z.string(), elements: z.array(motionElementSchema) })).optional(),
  transitions: z.record(z.string(), z.object({
    id: z.string(), primitive, durationFrames: z.number().int().positive().optional(), amount: z.number().optional(), easing: z.string().optional(),
  })).optional(),
  globalTiming: z.object({ defaultTransitionFrames: z.number().int().positive().optional(), sceneGapFrames: z.number().int().nonnegative().optional() }).optional(),
  scenes: z.array(scene).min(1).max(250),
}).superRefine((project, ctx) => {
  const sceneIds = new Set<string>();
  const safeSceneIds = new Set<string>();
  for (const [sceneIndex, sceneValue] of project.scenes.entries()) {
    const safeSceneId = sceneValue.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (sceneIds.has(sceneValue.id) || safeSceneIds.has(safeSceneId)) ctx.addIssue({ code: 'custom', path: ['scenes', sceneIndex, 'id'], message: 'Scene IDs must be unique after compiler normalization.' });
    sceneIds.add(sceneValue.id);
    safeSceneIds.add(safeSceneId);
    const elementIds = new Set(sceneValue.elements.map((element) => element.id));
    const safeElementIds = new Set<string>();
    for (const [elementIndex, element] of sceneValue.elements.entries()) {
      const safeElementId = element.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (safeElementIds.has(safeElementId)) ctx.addIssue({ code: 'custom', path: ['scenes', sceneIndex, 'elements', elementIndex, 'id'], message: 'Element IDs must be unique after compiler normalization.' });
      safeElementIds.add(safeElementId);
      if (element.parentId && (!elementIds.has(element.parentId) || element.parentId === element.id)) ctx.addIssue({ code: 'custom', path: ['scenes', sceneIndex, 'elements', elementIndex, 'parentId'], message: 'parentId must reference a different element in the same scene.' });
      if (element.style && !project.typographyStyles?.[element.style]) ctx.addIssue({ code: 'custom', path: ['scenes', sceneIndex, 'elements', elementIndex, 'style'], message: 'Text style must reference a project typography style.' });
    }
    for (const [key, reference] of [['transitionIn', sceneValue.transitionIn], ['transitionOut', sceneValue.transitionOut]] as const) {
      if (reference && typeof reference === 'object' && !project.transitions?.[reference.transitionId]) ctx.addIssue({ code: 'custom', path: ['scenes', sceneIndex, key], message: 'Transition reference must name a project transition definition.' });
    }
  }
});

export const correctionSchema = z.object({
  sceneId: z.string().min(1),
  elementId: z.string().min(1),
  issue: z.string().min(1),
  desiredCorrection: z.string().min(1),
  properties: motionElementBaseSchema.partial().omit({ id: true, kind: true, motions: true }).optional(),
  timing: z.object({ shiftFrames: z.number().int().optional(), durationScale: z.number().positive().optional() }).optional(),
  hierarchy: z.object({ parentId: z.string().nullable().optional() }).optional(),
});

export const MotionCompilerSchemas = {
  briefPlan: z.object({
    id: z.string().min(1), name: z.string().min(1), brief: z.string().min(1),
    resolution: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
    fps: z.number().positive().optional(), durationSeconds: z.number().positive().optional(),
    primaryFont: z.string().optional(), expressiveFont: z.string().optional(), colors: z.array(z.string()).min(1).optional(),
  }),
  projectCreate: z.object({ project: motionProjectSchema }),
  projectCompile: z.object({ projectId: z.string(), force: z.boolean().optional().default(false), dryRun: z.boolean().optional().default(false) }),
  projectUpdate: z.object({ projectId: z.string(), project: motionProjectSchema, compile: z.boolean().optional().default(true), dryRun: z.boolean().optional().default(false) }),
  projectVerify: z.object({ projectId: z.string(), detailed: z.boolean().optional().default(false) }),
  sceneBuild: z.object({ projectId: z.string(), sceneId: z.string(), dryRun: z.boolean().optional().default(false) }),
  sceneBatchBuild: z.object({ projectId: z.string(), sceneIds: z.array(z.string()).min(1), dryRun: z.boolean().optional().default(false) }),
  sequenceRetime: z.object({ projectId: z.string(), sceneDurations: z.record(z.string(), z.number().int().positive()), compile: z.boolean().optional().default(true), dryRun: z.boolean().optional().default(false) }),
  corrections: z.object({ projectId: z.string(), corrections: z.array(correctionSchema).min(1), dryRun: z.boolean().optional().default(false) }),
  render: z.object({
    projectId: z.string(), outputDirectory: z.string(), fileName: z.string(),
    sceneIds: z.array(z.string()).optional(), background: z.boolean().optional().default(true),
    waitForCompletion: z.boolean().optional().default(true),
    pollIntervalMs: z.number().int().min(250).max(10_000).optional().default(2_000),
    strictVisualValidation: z.boolean().optional().default(false), allowUniformFrames: z.boolean().optional().default(false),
  }),
  review: z.object({ projectId: z.string(), frames: z.array(z.number().int().nonnegative()).min(1).max(20).optional(), scalePercentage: z.number().min(5).max(100).optional().default(25) }),
  metrics: z.object({ projectId: z.string() }),
  attachCurrent: z.object({ projectId: z.string() }),
  typographySystem: z.object({ projectId: z.string(), styles: z.record(z.string(), typographyStyleSchema), compile: z.boolean().optional().default(false), dryRun: z.boolean().optional().default(false) }),
  componentDefine: z.object({ projectId: z.string(), component: z.object({ id: z.string().min(1), elements: z.array(motionElementSchema).min(1) }) }),
  componentApply: z.object({
    projectId: z.string(), componentId: z.string(), sceneIds: z.array(z.string()).min(1), instancePrefix: z.string().optional(),
    offset: vector.optional(), compile: z.boolean().optional().default(true), dryRun: z.boolean().optional().default(false),
  }),
  transitionSequence: z.object({
    projectId: z.string(), sceneIds: z.array(z.string()).min(1), primitive, edge: z.enum(['in', 'out']).optional().default('in'),
    compile: z.boolean().optional().default(true), dryRun: z.boolean().optional().default(false),
  }),
};
