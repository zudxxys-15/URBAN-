import * as THREE from 'three';

// Shared geometries (created once, reused across all instances)
const SHARED_GEO = {
  head: new THREE.SphereGeometry(0.22, 6, 5),
  torso: new THREE.BoxGeometry(0.5, 0.6, 0.3),
  leg: new THREE.BoxGeometry(0.14, 0.5, 0.14),
  arm: new THREE.BoxGeometry(0.12, 0.5, 0.12),
};

// Skin tone material (shared)
const SKIN_MAT = new THREE.MeshLambertMaterial({ color: 0xd4a574 });

// Outfit color palette
const OUTFIT_COLORS = [
  0x2563eb, // blue
  0xdc2626, // red
  0x16a34a, // green
  0xf59e0b, // amber
  0x7c3aed, // purple
];

// Pants color palette
const PANTS_COLORS = [
  0x1e293b, // dark navy
  0x44403c, // stone
  0x374151, // grey
  0x1c1917, // near-black
];

export class Pedestrian {
  constructor() {
    this.mesh = new THREE.Group();
    this.isWalking = false;
    this.walkTime = 0;
    this.walkSpeed = 4.0 + Math.random() * 2.0; // animation speed

    // Pick random colors
    const outfitColor = OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)];
    const pantsColor = PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)];

    const torsoMat = new THREE.MeshLambertMaterial({ color: outfitColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });

    // Head
    const head = new THREE.Mesh(SHARED_GEO.head, SKIN_MAT);
    head.position.set(0, 1.55, 0);
    head.castShadow = true;
    this.mesh.add(head);

    // Torso
    const torso = new THREE.Mesh(SHARED_GEO.torso, torsoMat);
    torso.position.set(0, 1.05, 0);
    torso.castShadow = true;
    this.mesh.add(torso);

    // Left leg (pivot at hip)
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.12, 0.75, 0);
    const leftLeg = new THREE.Mesh(SHARED_GEO.leg, pantsMat);
    leftLeg.position.set(0, -0.25, 0);
    leftLeg.castShadow = true;
    this.leftLegPivot.add(leftLeg);
    this.mesh.add(this.leftLegPivot);

    // Right leg (pivot at hip)
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.12, 0.75, 0);
    const rightLeg = new THREE.Mesh(SHARED_GEO.leg, pantsMat);
    rightLeg.position.set(0, -0.25, 0);
    rightLeg.castShadow = true;
    this.rightLegPivot.add(rightLeg);
    this.mesh.add(this.rightLegPivot);

    // Left arm (pivot at shoulder)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.35, 1.25, 0);
    const leftArm = new THREE.Mesh(SHARED_GEO.arm, torsoMat);
    leftArm.position.set(0, -0.25, 0);
    leftArm.castShadow = true;
    this.leftArmPivot.add(leftArm);
    this.mesh.add(this.leftArmPivot);

    // Right arm (pivot at shoulder)
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.35, 1.25, 0);
    const rightArm = new THREE.Mesh(SHARED_GEO.arm, torsoMat);
    rightArm.position.set(0, -0.25, 0);
    rightArm.castShadow = true;
    this.rightArmPivot.add(rightArm);
    this.mesh.add(this.rightArmPivot);

    // Store instance materials for disposal
    this._instanceMats = [torsoMat, pantsMat];
  }

  setWalking(walking) {
    this.isWalking = walking;
    if (!walking) {
      // Reset limb rotations
      this.leftLegPivot.rotation.x = 0;
      this.rightLegPivot.rotation.x = 0;
      this.leftArmPivot.rotation.x = 0;
      this.rightArmPivot.rotation.x = 0;
    }
  }

  animateWalk(dt) {
    if (!this.isWalking) return;

    this.walkTime += dt * this.walkSpeed;
    const swing = Math.sin(this.walkTime) * 0.45;

    // Legs swing opposite
    this.leftLegPivot.rotation.x = swing;
    this.rightLegPivot.rotation.x = -swing;

    // Arms swing opposite to legs
    this.leftArmPivot.rotation.x = -swing * 0.6;
    this.rightArmPivot.rotation.x = swing * 0.6;
  }

  dispose() {
    // Dispose instance materials only (shared geo/mats are kept)
    for (const mat of this._instanceMats) {
      mat.dispose();
    }
    this._instanceMats.length = 0;

    // Remove from parent
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}
