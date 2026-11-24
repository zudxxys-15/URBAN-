import * as THREE from 'three';

// Shared static materials — created once, reused across all TrafficVehicle instances
const BODY_COLORS = [0x3b82f6, 0xef4444, 0xfbbf24, 0x6b7280];

const sharedMaterials = {
  body: BODY_COLORS.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.6 })
  ),
  cabin: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.85 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.1 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xc4c4cc, roughness: 0.35, metalness: 0.85 }),
  headlight: new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
  taillight: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
};

// Shared geometries — created once
const sharedGeometry = {
  body: new THREE.BoxGeometry(1.7, 0.45, 3.6),
  cabin: new THREE.BoxGeometry(1.4, 0.5, 1.6),
  tire: (() => {
    const g = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  })(),
  rim: (() => {
    const g = new THREE.CylinderGeometry(0.18, 0.18, 0.26, 8);
    g.rotateZ(Math.PI / 2);
    return g;
  })(),
  headlight: new THREE.BoxGeometry(0.35, 0.08, 0.06),
  taillight: new THREE.BoxGeometry(1.4, 0.08, 0.06),
};

export class TrafficVehicle {
  /**
   * @param {number} [colorIndex] — index into BODY_COLORS; random if omitted
   */
  constructor(colorIndex) {
    this.mesh = new THREE.Group();
    this.mesh.visible = false; // pooled vehicles start hidden

    this.headlights = [];
    this.taillights = [];

    const bodyMat =
      sharedMaterials.body[
        colorIndex !== undefined ? colorIndex : Math.floor(Math.random() * BODY_COLORS.length)
      ];

    // --- Body ---
    const body = new THREE.Mesh(sharedGeometry.body, bodyMat);
    body.position.y = 0.42;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // --- Cabin ---
    const cabin = new THREE.Mesh(sharedGeometry.cabin, sharedMaterials.cabin);
    cabin.position.set(0, 0.87, 0.1);
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // --- Wheels (4) ---
    const wheelPositions = [
      { x: -0.85, z: -1.1 },
      { x: 0.85, z: -1.1 },
      { x: -0.85, z: 1.1 },
      { x: 0.85, z: 1.1 },
    ];
    wheelPositions.forEach((wp) => {
      const tire = new THREE.Mesh(sharedGeometry.tire, sharedMaterials.tire);
      tire.position.set(wp.x, 0.32, wp.z);
      tire.castShadow = true;
      this.mesh.add(tire);

      const rim = new THREE.Mesh(sharedGeometry.rim, sharedMaterials.rim);
      rim.position.set(wp.x, 0.32, wp.z);
      this.mesh.add(rim);
    });

    // --- Headlights ---
    const hlLeft = new THREE.Mesh(sharedGeometry.headlight, sharedMaterials.headlight);
    hlLeft.position.set(-0.55, 0.52, -1.82);
    hlLeft.visible = false;
    this.mesh.add(hlLeft);
    this.headlights.push(hlLeft);

    const hlRight = new THREE.Mesh(sharedGeometry.headlight, sharedMaterials.headlight);
    hlRight.position.set(0.55, 0.52, -1.82);
    hlRight.visible = false;
    this.mesh.add(hlRight);
    this.headlights.push(hlRight);

    // --- Taillight ---
    const tail = new THREE.Mesh(sharedGeometry.taillight, sharedMaterials.taillight);
    tail.position.set(0, 0.55, 1.82);
    tail.visible = false;
    this.mesh.add(tail);
    this.taillights.push(tail);
  }

  /** Toggle headlights and taillights on / off. */
  setHeadlightsOn(on) {
    this.headlights.forEach((l) => (l.visible = on));
    this.taillights.forEach((l) => (l.visible = on));
  }

  /** Remove from parent and release references. */
  dispose() {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    // Shared geometries + materials are static; nothing instance-specific to dispose.
    this.headlights.length = 0;
    this.taillights.length = 0;
  }
}
