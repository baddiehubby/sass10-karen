import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import {
  fitKarenAvatarToStage,
  isKarenBustMesh,
  KAREN_BUST_TARGET_HEIGHT,
  KAREN_REQUIRED_BLENDSHAPES,
  KAREN_TARGET_HEIGHT,
  karenProceduralMouthEnergy,
  relaxKarenFigureArms,
  verifyKarenBlendshapes,
} from "./avatar-fit";
import type { KarenAvatarProfile } from "./avatar-assets";

const BUST_PROFILE: KarenAvatarProfile = { facingYaw: -Math.PI / 2, kind: "bust" };
const FIGURE_PROFILE: KarenAvatarProfile = {
  facingYaw: 0,
  kind: "figure",
  faceCamDistance: 0.95,
  faceAimBelowEye: 0.04,
};

describe("avatar-fit", () => {
  it("scales oversized meshes toward ~1.6 height and plants feet on y=0", () => {
    const root = new THREE.Group();
    // Tall thin body (~4m) → full-body path.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.4));
    root.add(mesh);

    const fit = fitKarenAvatarToStage(root, BUST_PROFILE);
    assert.equal(fit.isBust, false);
    assert.ok(Math.abs(fit.height - KAREN_TARGET_HEIGHT) < 0.08);
    assert.ok(Math.abs(fit.center.x) < 0.05);
    assert.ok(Math.abs(fit.center.z) < 0.05);
    assert.ok(fit.eyeY > 1.0);

    const box = new THREE.Box3().setFromObject(root);
    assert.ok(Math.abs(box.min.y) < 0.02, "feet should sit on the floor");
  });

  it("scales tiny meshes up before refining", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1)));
    const fit = fitKarenAvatarToStage(root, BUST_PROFILE);
    assert.ok(fit.height > 0.5);
    assert.ok(fit.scale > 1);
  });

  it("treats squat Tripo-like busts with a smaller target height", () => {
    const root = new THREE.Group();
    // ~1.5m cube-ish head/shoulder crop.
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.0)));
    assert.equal(isKarenBustMesh(1.4, new THREE.Vector3(1.2, 1.4, 1.0)), true);

    const fit = fitKarenAvatarToStage(root, BUST_PROFILE);
    assert.equal(fit.isBust, true);
    assert.equal(fit.face, undefined);
    assert.ok(Math.abs(fit.height - KAREN_BUST_TARGET_HEIGHT) < 0.08);
    assert.ok(fit.eyeY < 1.0);
  });

  it("a wide T-pose figure is NOT shrunk to a bust and is aimed at its eye bones", () => {
    // 1.8 m tall, 1.7 m arm span (T-pose): width heuristic alone would call this a bust.
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.8, 0.3));
    body.position.y = 0.9; // body spans y 0 → 1.8 like a real standing figure
    root.add(body);
    const hips = new THREE.Bone();
    const left = new THREE.Bone();
    const right = new THREE.Bone();
    left.name = "LeftEye";
    right.name = "RightEye";
    left.position.set(-0.03, 1.6, 0);
    right.position.set(0.03, 1.6, 0);
    hips.add(left, right);
    root.add(hips);

    const asBust = fitKarenAvatarToStage(root, BUST_PROFILE);
    assert.equal(asBust.isBust, true, "sanity: the heuristic really would shrink this");

    const fit = fitKarenAvatarToStage(root, FIGURE_PROFILE);
    assert.equal(fit.isBust, false);
    assert.ok(Math.abs(fit.height - KAREN_TARGET_HEIGHT) < 0.1, `height ${fit.height}`);
    assert.ok(fit.face, "figure gets a face frame");
    assert.equal(fit.face!.fromBones, true);
    // Eye bones sat at ~89% of the body → after scaling to 1.6 m that is ≈ 1.42 m.
    assert.ok(Math.abs(fit.eyeY - 1.6 * (1.6 / 1.8)) < 0.08, `eyeY ${fit.eyeY}`);
    assert.ok(Math.abs(fit.face!.aimY - (fit.eyeY - 0.04)) < 1e-9);
    assert.ok(Math.abs(fit.face!.dist - 0.95) < 0.05);
  });

  it("a figure with no eye bones falls back to a body-fraction eye line", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3)));
    const fit = fitKarenAvatarToStage(root, FIGURE_PROFILE);
    assert.equal(fit.face!.fromBones, false);
    assert.ok(fit.eyeY > 1.3 && fit.eyeY < 1.6);
  });

  it("applies the profile's facing yaw (and re-fits without compounding)", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3)));
    fitKarenAvatarToStage(root, FIGURE_PROFILE);
    assert.equal(root.rotation.y, 0);
    fitKarenAvatarToStage(root, BUST_PROFILE);
    assert.ok(Math.abs(root.rotation.y + Math.PI / 2) < 1e-9);
    const a = fitKarenAvatarToStage(root, BUST_PROFILE).scale;
    const b = fitKarenAvatarToStage(root, BUST_PROFILE).scale;
    assert.ok(Math.abs(a - b) < 1e-9);
  });

  it("relaxes T-pose arms idempotently (never compounds across re-fits)", () => {
    const root = new THREE.Group();
    const l = new THREE.Bone();
    const r = new THREE.Bone();
    const other = new THREE.Bone();
    l.name = "LeftArm";
    r.name = "RightArm";
    other.name = "LeftForeArm";
    l.rotation.x = 0.001;
    r.rotation.x = 0.002;
    root.add(l, r, other);

    assert.equal(relaxKarenFigureArms(root, 1.25), 2, "only the two upper-arm bones move");
    assert.ok(Math.abs(l.rotation.x - 1.251) < 1e-9);
    assert.ok(Math.abs(r.rotation.x - 1.252) < 1e-9);
    assert.equal(other.rotation.x, 0, "forearm untouched");

    relaxKarenFigureArms(root, 1.25);
    relaxKarenFigureArms(root, 1.25);
    assert.ok(Math.abs(l.rotation.x - 1.251) < 1e-9, "same result after repeated calls");
  });

  it("procedural mouth envelope stays in range, actually moves, and opens AND closes", () => {
    let min = Infinity;
    let max = -Infinity;
    let sign = 0;
    let flips = 0;
    let prev = karenProceduralMouthEnergy(0);
    for (let t = 16; t < 6000; t += 16) {
      const v = karenProceduralMouthEnergy(t);
      assert.ok(v >= 0 && v <= 0.85, `out of range: ${v} @${t}`);
      min = Math.min(min, v);
      max = Math.max(max, v);
      const s = Math.sign(v - prev);
      if (s !== 0 && sign !== 0 && s !== sign) flips++;
      if (s !== 0) sign = s;
      prev = v;
    }
    assert.ok(min < 0.05, `mouth should close fully between syllables (min ${min})`);
    assert.ok(max > 0.55, `mouth should open wide on stressed syllables (max ${max})`);
    // ~4.6 syllables/s over 6 s ⇒ dozens of open/close reversals, not a frozen value.
    assert.ok(flips > 40, `expected syllable-rate oscillation, got ${flips} reversals`);
  });

  it("flags missing ARKit blendshapes as CRITICAL failure", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    const report = verifyKarenBlendshapes(root);
    assert.equal(report.ok, false);
    assert.deepEqual(report.missing, [...KAREN_REQUIRED_BLENDSHAPES]);
  });

  it("passes when required morphs exist", () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.morphAttributes.position = [
      geo.attributes.position.clone(),
      geo.attributes.position.clone(),
      geo.attributes.position.clone(),
      geo.attributes.position.clone(),
    ];
    const mesh = new THREE.Mesh(geo);
    mesh.morphTargetDictionary = {
      jawOpen: 0,
      browDownLeft: 1,
      browDownRight: 2,
      mouthSmileLeft: 3,
    };
    mesh.morphTargetInfluences = [0, 0, 0, 0];
    const root = new THREE.Group();
    root.add(mesh);
    const report = verifyKarenBlendshapes(root);
    assert.equal(report.ok, true);
    assert.equal(report.missing.length, 0);
  });
});
