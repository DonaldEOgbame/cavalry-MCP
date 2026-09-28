import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { certificationStatus, primitiveFingerprint, primitiveFingerprints, primitiveReferenceProject, primitivesUsed, referenceReviewFrames, refreshCertification } from '../../src/motion/certification.js';
import { compileMotionProject } from '../../src/motion/compiler.js';
import { MOTION_PRIMITIVES } from '../../src/motion/types.js';

describe('motion primitive certification', () => {
  it('fingerprints every primitive deterministically and distinctly', () => {
    const fingerprints = primitiveFingerprints();
    assert.equal(Object.keys(fingerprints).length, 16);
    assert.equal(new Set(Object.values(fingerprints)).size, 16);
    assert.equal(primitiveFingerprint('enterUp'), fingerprints.enterUp);
  });

  it('builds one labelled reference scene per primitive with review frames inside each scene', () => {
    const project = primitiveReferenceProject();
    const plan = compileMotionProject(project);
    assert.equal(plan.scenes.length, 16);
    for (const [index, { primitive, frames }] of referenceReviewFrames().entries()) {
      assert.equal(primitive, MOTION_PRIMITIVES[index]);
      for (const frame of frames) assert.ok(frame >= plan.scenes[index].startFrame && frame <= plan.scenes[index].endFrame);
    }
  });

  it('reports pending, certified, and changed-since-approval primitives', () => {
    const pending = refreshCertification(null);
    assert.deepEqual(certificationStatus(['enterUp'], pending).pendingApproval, ['enterUp']);
    const approved = refreshCertification(pending, { by: 'reviewer', evidence: {} });
    const status = certificationStatus(['enterUp', 'hardCut'], approved);
    assert.deepEqual(status.certified, ['enterUp', 'hardCut']);
    assert.equal(status.allCertified, true);
    approved.approvals.hardCut.fingerprint = 'stale';
    assert.deepEqual(certificationStatus(['hardCut'], approved).changedSinceApproval, ['hardCut']);
    const refreshed = refreshCertification(approved);
    assert.equal(refreshed.approvals.enterUp.approved, true, 'unchanged approvals are kept');
    assert.equal(refreshed.approvals.hardCut.approved, false, 'a changed implementation needs re-approval');
  });

  it('collects primitives from element motions and transitions', () => {
    const project = primitiveReferenceProject();
    project.scenes = project.scenes.slice(0, 2);
    project.transitions = { exit: { id: 'exit', primitive: 'zoomThrough' } };
    project.scenes[0].transitionOut = { transitionId: 'exit' };
    assert.deepEqual(primitivesUsed(project), ['enterUp', 'enterDown', 'zoomThrough']);
  });
});
