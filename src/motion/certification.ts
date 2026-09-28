import fs from 'node:fs';
import { packagePath } from '../utils/paths.js';
import { compileMotionProject, motionHash } from './compiler.js';
import { MOTION_PRIMITIVES, MotionPrimitive, MotionProjectSpec } from './types.js';

/**
 * Visual certification of motion primitives. Each primitive's compiled
 * implementation is fingerprinted; a person approves how a fingerprint looks
 * once (from the reference composition's rendered frames), and the compiler
 * reports any primitive whose implementation is unapproved or has changed
 * since approval.
 */
export const CERTIFICATION_SCHEMA_VERSION = 1;

export interface PrimitiveApproval {
  approved: boolean;
  fingerprint: string;
  approvedAt?: string;
  approvedBy?: string;
  evidence?: string[];
}

export interface CertificationRecord {
  schemaVersion: typeof CERTIFICATION_SCHEMA_VERSION;
  generatedAt: string;
  compilerFingerprints: Record<string, string>;
  approvals: Record<string, PrimitiveApproval>;
}

export interface CertificationStatus {
  certified: MotionPrimitive[];
  pendingApproval: MotionPrimitive[];
  changedSinceApproval: MotionPrimitive[];
  allCertified: boolean;
}

function probeProject(primitive: MotionPrimitive): MotionProjectSpec {
  return {
    id: `certification-${primitive}`, name: primitive, resolution: { width: 1920, height: 1080 }, fps: 30,
    scenes: [{ id: 'probe', durationFrames: 45, background: '#111827', elements: [
      { id: 'subject', kind: 'text', text: 'PROBE', position: { x: 0, y: 0 }, motions: [{ type: primitive, durationFrames: 16 }] },
    ] }],
  };
}

/** Hash of the operations a primitive compiles to, independent of operation ids. */
export function primitiveFingerprint(primitive: MotionPrimitive): string {
  const [scene] = compileMotionProject(probeProject(primitive)).scenes;
  return motionHash(scene.operations.map(({ op, params, saveAs }) => ({ op, params, saveAs: saveAs ?? null })));
}

export function primitiveFingerprints(): Record<MotionPrimitive, string> {
  return Object.fromEntries(MOTION_PRIMITIVES.map((primitive) => [primitive, primitiveFingerprint(primitive)])) as Record<MotionPrimitive, string>;
}

/** One 45-frame scene per primitive, labelled, for a single reference review. */
export function primitiveReferenceProject(): MotionProjectSpec {
  return {
    id: 'motion-primitive-reference',
    name: 'Motion Primitive Reference',
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    typographyStyles: {
      subject: { fontFamily: 'Helvetica', fontStyle: 'Bold', fontSize: 120, color: '#ffffff', alignment: 'center' },
      label: { fontFamily: 'Helvetica', fontStyle: 'Regular', fontSize: 36, color: '#9ca3af', alignment: 'center' },
    },
    scenes: MOTION_PRIMITIVES.map((primitive) => ({
      id: `primitive-${primitive}`,
      name: primitive,
      durationFrames: 45,
      background: '#111827',
      elements: [
        { id: 'subject', kind: 'text' as const, text: 'MOTION', style: 'subject', position: { x: 0, y: 40 }, motions: [{ type: primitive, durationFrames: 16 }] },
        { id: 'label', kind: 'text' as const, text: primitive, style: 'label', position: { x: 0, y: -300 } },
      ],
    })),
  };
}

/** Frames per primitive: mid-transition, transition end, settled. */
export function referenceReviewFrames(): Array<{ primitive: MotionPrimitive; frames: number[] }> {
  const plan = compileMotionProject(primitiveReferenceProject());
  return plan.scenes.map((scene, index) => ({ primitive: MOTION_PRIMITIVES[index], frames: [scene.startFrame + 8, scene.startFrame + 16, scene.startFrame + 36] }));
}

export function certificationPath(): string {
  return process.env.CAVALRY_PRIMITIVE_CERTIFICATION ?? packagePath('coverage', 'motion-primitive-certification.json');
}

let cached: { path: string; record: CertificationRecord | null } | null = null;

export function loadCertification(file = certificationPath()): CertificationRecord | null {
  if (cached?.path === file) return cached.record;
  let record: CertificationRecord | null = null;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')) as CertificationRecord; } catch {}
  cached = { path: file, record };
  return record;
}

export function primitivesUsed(spec: MotionProjectSpec): MotionPrimitive[] {
  const used = new Set<MotionPrimitive>();
  for (const scene of spec.scenes) {
    for (const element of scene.elements) for (const motion of element.motions ?? []) used.add(motion.type);
    for (const reference of [scene.transitionIn, scene.transitionOut]) {
      if (!reference) continue;
      if (typeof reference === 'string') used.add(reference);
      else if (spec.transitions?.[reference.transitionId]) used.add(spec.transitions[reference.transitionId].primitive);
    }
  }
  return MOTION_PRIMITIVES.filter((primitive) => used.has(primitive));
}

export function certificationStatus(primitives: readonly MotionPrimitive[], record = loadCertification()): CertificationStatus {
  const status: CertificationStatus = { certified: [], pendingApproval: [], changedSinceApproval: [], allCertified: false };
  for (const primitive of primitives) {
    const approval = record?.approvals?.[primitive];
    if (!approval?.approved) status.pendingApproval.push(primitive);
    else if (approval.fingerprint !== primitiveFingerprint(primitive)) status.changedSinceApproval.push(primitive);
    else status.certified.push(primitive);
  }
  status.allCertified = status.pendingApproval.length === 0 && status.changedSinceApproval.length === 0;
  return status;
}

/** Refreshes fingerprints, keeping approvals whose fingerprint is unchanged. */
export function refreshCertification(previous: CertificationRecord | null, approve?: { by: string; evidence: Record<string, string[]> }): CertificationRecord {
  const fingerprints = primitiveFingerprints();
  const approvals: Record<string, PrimitiveApproval> = {};
  for (const primitive of MOTION_PRIMITIVES) {
    const prior = previous?.approvals?.[primitive];
    const current = fingerprints[primitive];
    if (approve) approvals[primitive] = { approved: true, fingerprint: current, approvedAt: new Date().toISOString(), approvedBy: approve.by, evidence: approve.evidence[primitive] ?? [] };
    else if (prior?.approved && prior.fingerprint === current) approvals[primitive] = prior;
    else approvals[primitive] = { approved: false, fingerprint: current, ...(prior?.evidence ? { evidence: prior.evidence } : {}) };
  }
  return { schemaVersion: CERTIFICATION_SCHEMA_VERSION, generatedAt: new Date().toISOString(), compilerFingerprints: fingerprints, approvals };
}
