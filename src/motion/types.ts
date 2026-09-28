export const MOTION_PRIMITIVES = [
  'enterUp', 'enterDown', 'enterLeft', 'enterRight', 'wordSwap',
  'verticalRoll', 'progressiveBuild', 'textReflow', 'pushTransition',
  'scaleTakeover', 'scaleTransfer', 'zoomThrough', 'maskedReveal',
  'trackingExpansion', 'colorSnap', 'hardCut',
] as const;

export type MotionPrimitive = typeof MOTION_PRIMITIVES[number];

export interface MotionBehavior {
  type: MotionPrimitive;
  startFrame?: number;
  durationFrames?: number;
  amount?: number;
  from?: number | string;
  to?: number | string;
  easing?: string;
}

export interface TypographyStyle {
  fontFamily: string;
  fontStyle?: string;
  fontSize: number;
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  tracking?: number;
  lineHeight?: number;
}

export interface MotionElement {
  id: string;
  kind: 'text' | 'rectangle' | 'ellipse' | 'group';
  name?: string;
  text?: string;
  style?: string;
  parentId?: string;
  position?: { x: number; y: number };
  scale?: number | { x: number; y: number };
  opacity?: number;
  rotation?: number;
  color?: string;
  width?: number;
  height?: number;
  tracking?: number;
  lineHeight?: number;
  motions?: MotionBehavior[];
}

export interface MotionScene {
  id: string;
  name?: string;
  durationFrames: number;
  background: string;
  elements: MotionElement[];
  transitionIn?: MotionPrimitive | { transitionId: string };
  transitionOut?: MotionPrimitive | { transitionId: string };
}

export interface MotionComponentDefinition {
  id: string;
  elements: MotionElement[];
}

export interface MotionTransitionDefinition {
  id: string;
  primitive: MotionPrimitive;
  durationFrames?: number;
  amount?: number;
  easing?: string;
}

export interface MotionProjectSpec {
  id: string;
  name: string;
  resolution: { width: number; height: number };
  fps: number;
  designTokens?: {
    colors?: Record<string, string>;
    spacing?: Record<string, number>;
    typographyScale?: Record<string, number>;
  };
  typographyStyles?: Record<string, TypographyStyle>;
  components?: Record<string, MotionComponentDefinition>;
  transitions?: Record<string, MotionTransitionDefinition>;
  globalTiming?: { defaultTransitionFrames?: number; sceneGapFrames?: number };
  scenes: MotionScene[];
}

export interface MotionCorrection {
  sceneId: string;
  elementId: string;
  issue: string;
  desiredCorrection: string;
  properties?: Partial<Omit<MotionElement, 'id' | 'kind' | 'motions'>>;
  timing?: { shiftFrames?: number; durationScale?: number };
  hierarchy?: { parentId?: string | null };
}

export interface CompiledMotionOperation {
  id: string;
  op: string;
  params: Record<string, unknown>;
  saveAs?: string;
}

export interface CompiledScenePlan {
  sceneId: string;
  startFrame: number;
  endFrame: number;
  hash: string;
  operations: CompiledMotionOperation[];
  expectedLayers: number;
  expectedKeyframes: number;
}

export interface CompiledProjectPlan {
  projectId: string;
  hash: string;
  durationFrames: number;
  scenes: CompiledScenePlan[];
  operationCount: number;
  expectedLayers: number;
  expectedKeyframes: number;
}

export interface MotionTelemetry {
  projectId: string;
  highLevelCallCount: number;
  bridgeOperationCount: number;
  batchCount: number;
  averageBatchSize: number;
  planningMs: number;
  compilationMs: number;
  cavalryExecutionMs: number;
  validationMs: number;
  renderMs: number;
  qcMs: number;
  correctionMs: number;
  totalServerMs: number;
  modelReasoningMs: null;
  notes: string[];
}
