import * as THREE from 'three';

export class WorldPolish {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/CollisionSystem.js').CollisionSystem} collisionSystem
   */
  constructor(scene, collisionSystem = null) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this.group = new THREE.Group();

    this.streetLightGlobes = [];
    this.carMeetPos = { x: 75, z: 75 };

    this.buildRoadMarkings();
    this.buildStreetLightGlobes();
    this.buildCarMeetArea();
    this.buildDecorations();

    this.scene.add(this.group);
  }

  buildRoadMarkings() {
    // 1. Center dashed yellow lines
    // East-West road (Z=0, X from -120 to 120, skipping intersection -12 to 12)
    // North-South road (X=0, Z from -120 to 120, skipping intersection -12 to 12)
    const dashLength = 2.0;
    const dashWidth = 0.2;
    const spacing = 4.0;
    const dashPositions = [];

    // East-West
    for (let x = -120; x <= 120; x += spacing) {
      if (Math.abs(x) > 12) {
        dashPositions.push({ x, z: 0, rotY: 0, scaleX: dashLength, scaleZ: dashWidth });
      }
    }
    // North-South
    for (let z = -120; z <= 120; z += spacing) {
      if (Math.abs(z) > 12) {
        dashPositions.push({ x: 0, z, rotY: Math.PI / 2, scaleX: dashLength, scaleZ: dashWidth });
      }
    }

    const dashGeo = new THREE.PlaneGeometry(1, 1);
    dashGeo.rotateX(-Math.PI / 2);
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthWrite: false });

    const dashInst = new THREE.InstancedMesh(dashGeo, yellowMat, dashPositions.length);
    const dummy = new THREE.Object3D();

    dashPositions.forEach((dp, i) => {
      dummy.position.set(dp.x, 0.02, dp.z);
      dummy.rotation.set(0, dp.rotY, 0);
      dummy.scale.set(dp.scaleX, 1, dp.scaleZ);
      dummy.updateMatrix();
      dashInst.setMatrixAt(i, dummy.matrix);
    });
    dashInst.instanceMatrix.needsUpdate = true;
    this.group.add(dashInst);

    // 2. White solid road edge lines (Z=±7 for E-W road, X=±7 for N-S road)
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, depthWrite: false });
    const edgeThickness = 0.18;

    // Outer segments along E-W road
    const ewSegments = [
      { x: -68, z: -7, w: 104 },
      { x: 68, z: -7, w: 104 },
      { x: -68, z: 7, w: 104 },
      { x: 68, z: 7, w: 104 }
    ];
    ewSegments.forEach(seg => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(seg.w, edgeThickness), whiteMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(seg.x, 0.02, seg.z);
      this.group.add(line);
    });

    // Outer segments along N-S road
    const nsSegments = [
      { x: -7, z: -68, h: 104 },
      { x: -7, z: 68, h: 104 },
      { x: 7, z: -68, h: 104 },
      { x: 7, z: 68, h: 104 }
    ];
    nsSegments.forEach(seg => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(edgeThickness, seg.h), whiteMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(seg.x, 0.02, seg.z);
      this.group.add(line);
    });

    // 3. Crosswalk markings at 4 intersection approaches (±13m from center)
    const crosswalkBars = [];
    const barWidth = 0.5;
    const barLength = 3.6;
    const offsets = [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0];

    // North crosswalk (Z = -13)
    offsets.forEach(off => crosswalkBars.push({ x: off, z: -13, rotY: 0 }));
    // South crosswalk (Z = 13)
    offsets.forEach(off => crosswalkBars.push({ x: off, z: 13, rotY: 0 }));
    // West crosswalk (X = -13)
    offsets.forEach(off => crosswalkBars.push({ x: -13, z: off, rotY: Math.PI / 2 }));
    // East crosswalk (X = 13)
    offsets.forEach(off => crosswalkBars.push({ x: 13, z: off, rotY: Math.PI / 2 }));

    const cwInst = new THREE.InstancedMesh(dashGeo, whiteMat, crosswalkBars.length);
    crosswalkBars.forEach((b, i) => {
      dummy.position.set(b.x, 0.025, b.z);
      dummy.rotation.set(0, b.rotY, 0);
      dummy.scale.set(barLength, 1, barWidth);
      dummy.updateMatrix();
      cwInst.setMatrixAt(i, dummy.matrix);
    });
    cwInst.instanceMatrix.needsUpdate = true;
    this.group.add(cwInst);

    // 4. Parking Stall Lines
    // Spots at Garage (0, -30), Gas Station (45, 0), Dealership (0, 30)
    const parkingSpots = [
      // Near Garage
      { x: -6, z: -26 }, { x: -6, z: -30 }, { x: -6, z: -34 },
      // Near Gas Station
      { x: 40, z: -6 }, { x: 40, z: 6 },
      // Near Dealership
      { x: -6, z: 26 }, { x: -6, z: 30 }, { x: -6, z: 34 }
    ];

    const parkLineMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, depthWrite: false });
    parkingSpots.forEach(p => {
      const stall = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.6), new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.12,
        depthWrite: false
      }));
      stall.rotation.x = -Math.PI / 2;
      stall.position.set(p.x, 0.022, p.z);
      this.group.add(stall);
    });
  }

  buildStreetLightGlobes() {
    const lampPositions = [
      { x: -14, z: -35 }, { x: 14, z: -35 },
      { x: -14, z: 35 }, { x: 14, z: 35 },
      { x: -35, z: -14 }, { x: -35, z: 14 },
      { x: 35, z: -14 }, { x: 35, z: 14 }
    ];

    const globeGeo = new THREE.SphereGeometry(0.35, 8, 8);
    this.globeMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff7ed,
      transparent: true,
      opacity: 0.35
    });

    lampPositions.forEach(pos => {
      const globe = new THREE.Mesh(globeGeo, this.globeMaterial);
      globe.position.set(pos.x, 5.5, pos.z);
      this.group.add(globe);
      this.streetLightGlobes.push(globe);
    });
  }

  setNightMode(isNight) {
    if (!this.globeMaterial) return;
    if (isNight) {
      this.globeMaterial.opacity = 0.95;
      this.globeMaterial.color.set(0xffedd5);
    } else {
      this.globeMaterial.opacity = 0.35;
      this.globeMaterial.color.set(0xfff7ed);
    }
  }

  buildCarMeetArea() {
    const cx = this.carMeetPos.x;
    const cz = this.carMeetPos.z;

    // Plaza concrete base
    const plazaGeo = new THREE.CylinderGeometry(18, 18, 0.2, 32);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.3
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(cx, 0.1, cz);
    plaza.receiveShadow = true;
    this.group.add(plaza);

    // Glowing outer accent ring
    const ringGeo = new THREE.RingGeometry(17.2, 17.8, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.22, cz);
    this.group.add(ring);

    // Central Showcase Platform
    const centerGeo = new THREE.CylinderGeometry(5.0, 5.0, 0.35, 24);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8
    });
    const centerPlatform = new THREE.Mesh(centerGeo, centerMat);
    centerPlatform.position.set(cx, 0.27, cz);
    centerPlatform.receiveShadow = true;
    centerPlatform.castShadow = true;
    this.group.add(centerPlatform);

    // Floor decal ring for interaction
    const showcaseRing = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 5.0, 24),
      new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide })
    );
    showcaseRing.rotation.x = -Math.PI / 2;
    showcaseRing.position.set(cx, 0.46, cz);
    this.group.add(showcaseRing);

    // 4 Showcase Tuner Cars parked around the center
    const displayConfigs = [
      { angle: 0, color: 0xe11d48, name: 'Scarlet GT' },
      { angle: Math.PI / 2, color: 0x2563eb, name: 'Midnight Stance' },
      { angle: Math.PI, color: 0xeab308, name: 'Sunburst Drift' },
      { angle: -Math.PI / 2, color: 0x10b981, name: 'Emerald Circuit' }
    ];

    displayConfigs.forEach(cfg => {
      const dist = 11.0;
      const carGroup = new THREE.Group();
      carGroup.position.set(
        cx + Math.cos(cfg.angle) * dist,
        0.2,
        cz + Math.sin(cfg.angle) * dist
      );
      carGroup.rotation.y = -cfg.angle + Math.PI / 2;

      // Body
      const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.35, metalness: 0.75 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 3.8), bodyMat);
      body.position.y = 0.42;
      body.castShadow = true;
      carGroup.add(body);

      // Cabin
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2, metalness: 0.9 });
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.8), cabinMat);
      cabin.position.set(0, 0.82, 0.1);
      cabin.castShadow = true;
      carGroup.add(cabin);

      // GT Spoiler
      const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.3), spoilerMat);
      spoiler.position.set(0, 1.05, 1.7);
      carGroup.add(spoiler);

      // Wheels
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.8 });
      const wheelOffsets = [
        [-0.9, -1.2], [0.9, -1.2],
        [-0.9, 1.2], [0.9, 1.2]
      ];
      wheelOffsets.forEach(([wx, wz]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.32, wz);
        carGroup.add(wheel);
      });

      this.group.add(carGroup);

      // Register collision box for parked cars
      if (this.collisionSystem) {
        this.collisionSystem.addBox(
          carGroup.position.x - 1.2,
          carGroup.position.x + 1.2,
          carGroup.position.z - 1.2,
          carGroup.position.z + 1.2,
          2.0,
          'parked_car'
        );
      }
    });

    // Add collision for center platform
    if (this.collisionSystem) {
      this.collisionSystem.addBox(
        cx - 2.5,
        cx + 2.5,
        cz - 2.5,
        cz + 2.5,
        0.5,
        'car_meet_stage'
      );
    }
  }

  buildDecorations() {
    // 8 Benches along sidewalk perimeters (InstancedMesh)
    const benchPositions = [
      { x: -18, z: -20, ry: 0 },
      { x: 18, z: -20, ry: Math.PI },
      { x: -18, z: 20, ry: 0 },
      { x: 18, z: 20, ry: Math.PI },
      { x: -20, z: -18, ry: Math.PI / 2 },
      { x: -20, z: 18, ry: Math.PI / 2 },
      { x: 20, z: -18, ry: -Math.PI / 2 },
      { x: 20, z: 18, ry: -Math.PI / 2 }
    ];

    const benchGeo = new THREE.BoxGeometry(1.6, 0.42, 0.55);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const benchInst = new THREE.InstancedMesh(benchGeo, benchMat, benchPositions.length);
    benchInst.castShadow = true;

    const dummy = new THREE.Object3D();
    benchPositions.forEach((b, i) => {
      dummy.position.set(b.x, 0.35, b.z);
      dummy.rotation.set(0, b.ry, 0);
      dummy.updateMatrix();
      benchInst.setMatrixAt(i, dummy.matrix);

      if (this.collisionSystem) {
        this.collisionSystem.addBox(b.x - 0.8, b.x + 0.8, b.z - 0.4, b.z + 0.4, 0.8, 'bench');
      }
    });
    benchInst.instanceMatrix.needsUpdate = true;
    this.group.add(benchInst);

    // 6 Planter boxes near points of interest (InstancedMesh)
    const planterPositions = [
      { x: -10, z: -28 },
      { x: 10, z: -28 },
      { x: 38, z: -8 },
      { x: 38, z: 8 },
      { x: -10, z: 28 },
      { x: 10, z: 28 }
    ];

    const planterGeo = new THREE.BoxGeometry(1.2, 0.7, 1.2);
    const planterMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const planterInst = new THREE.InstancedMesh(planterGeo, planterMat, planterPositions.length);
    planterInst.castShadow = true;

    planterPositions.forEach((p, i) => {
      dummy.position.set(p.x, 0.45, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      planterInst.setMatrixAt(i, dummy.matrix);

      if (this.collisionSystem) {
        this.collisionSystem.addBox(p.x - 0.6, p.x + 0.6, p.z - 0.6, p.z + 0.6, 1.0, 'planter');
      }
    });
    planterInst.instanceMatrix.needsUpdate = true;
    this.group.add(planterInst);
  }

  getCarMeetPosition() {
    return { ...this.carMeetPos };
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this.scene.remove(this.group);
  }
}
