import * as THREE from 'three';

export class UrbanEnvironment {
  constructor(scene, collisionSystem) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this.group = new THREE.Group();

    this.citySize = 260; // 260x260m urban environment
    this.detailObjects = []; // for distance LOD / Low preset culling
    this.buildingMeshes = [];

    this.buildGroundAndRoads();
    this.buildCityBlocks();
    this.buildInteractiveZones();
    this.buildStreetFurnitureInstanced();

    this.scene.add(this.group);
  }

  buildGroundAndRoads() {
    // 1. Asphalt Ground
    const groundGeo = new THREE.PlaneGeometry(this.citySize * 1.5, this.citySize * 1.5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Outer boundary collision
    const half = this.citySize / 2;
    const wallThick = 4;
    const wallHeight = 10;
    this.collisionSystem.addBox(-half, half, half, half + wallThick, wallHeight, 'boundary');
    this.collisionSystem.addBox(-half, half, -half - wallThick, -half, wallHeight, 'boundary');
    this.collisionSystem.addBox(-half - wallThick, -half, -half, half, wallHeight, 'boundary');
    this.collisionSystem.addBox(half, half + wallThick, -half, half, wallHeight, 'boundary');

    // Perimeter curbs
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.5 });
    const barNorth = new THREE.Mesh(new THREE.BoxGeometry(this.citySize, 1.2, 0.8), barrierMat);
    barNorth.position.set(0, 0.6, half);
    this.group.add(barNorth);

    const barSouth = new THREE.Mesh(new THREE.BoxGeometry(this.citySize, 1.2, 0.8), barrierMat);
    barSouth.position.set(0, 0.6, -half);
    this.group.add(barSouth);

    const barEast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, this.citySize), barrierMat);
    barEast.position.set(half, 0.6, 0);
    this.group.add(barEast);

    const barWest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, this.citySize), barrierMat);
    barWest.position.set(-half, 0.6, 0);
    this.group.add(barWest);
  }

  buildCityBlocks() {
    // Reusable shared materials to minimize WebGL pipeline switches
    const sharedMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.9 })
    ];

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9, metalness: 0.1 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.05 });

    const blockConfigs = [
      { cx: -65, cz: -65, sx: 85, sz: 85 },
      { cx: 65, cz: -65, sx: 85, sz: 85 },
      { cx: -65, cz: 65, sx: 85, sz: 85 },
      { cx: 65, cz: 65, sx: 85, sz: 85 }
    ];

    blockConfigs.forEach((q, qIdx) => {
      // Concrete sidewalk base
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(q.sx, 0.25, q.sz), sidewalkMat);
      sidewalk.position.set(q.cx, 0.125, q.cz);
      sidewalk.receiveShadow = true;
      this.group.add(sidewalk);

      const subOffset = 22;
      const bSizes = [
        { dx: -subOffset, dz: -subOffset, w: 32, d: 32, h: 28 + (qIdx * 7) % 25 },
        { dx: subOffset, dz: -subOffset, w: 30, d: 32, h: 42 + (qIdx * 11) % 30 },
        { dx: -subOffset, dz: subOffset, w: 32, d: 30, h: 22 + (qIdx * 9) % 20 },
        { dx: subOffset, dz: subOffset, w: 30, d: 30, h: 36 + (qIdx * 13) % 28 }
      ];

      bSizes.forEach((b, bIdx) => {
        const bx = q.cx + b.dx;
        const bz = q.cz + b.dz;
        const by = b.h / 2 + 0.25;

        const mat = sharedMaterials[(qIdx + bIdx) % sharedMaterials.length];

        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
        bMesh.position.set(bx, by, bz);
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        this.group.add(bMesh);
        this.buildingMeshes.push(bMesh);

        // Roof cap detail
        const roofCap = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, 2.0, b.d * 0.7), roofMat);
        roofCap.position.set(bx, b.h + 1.0 + 0.25, bz);
        roofCap.castShadow = true;
        this.group.add(roofCap);
        this.detailObjects.push(roofCap);

        // Collision box
        const halfW = b.w / 2;
        const halfD = b.d / 2;
        this.collisionSystem.addBox(bx - halfW, bx + halfW, bz - halfD, bz + halfD, b.h, 'building');
      });
    });
  }

  buildInteractiveZones() {
    // 1. Garage Entrance Zone (North road at 0, -32)
    const garageFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant automotive cyan
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.8
    });
    const garageMarker = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 0.1, 32), garageFloorMat);
    garageMarker.position.set(0, 0.05, -30);
    this.group.add(garageMarker);

    // Garage Overhead Signpost
    const signMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2 });
    const signPillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.0, 0.4), signMat);
    signPillar.position.set(-6, 2.0, -30);
    this.group.add(signPillar);

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.2, 0.2), signMat);
    signBoard.position.set(-6, 4.2, -30);
    this.group.add(signBoard);

    // 2. Gas Station Refueling Zone (East road at 45, 0)
    const gasFloorMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a, // Green energy station
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.8
    });
    const gasMarker = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 0.1, 32), gasFloorMat);
    gasMarker.position.set(45, 0.05, 0);
    this.group.add(gasMarker);

    // Gas pump dispenser model
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 });
    const pump = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.8), pumpMat);
    pump.position.set(45, 1.2, -4);
    pump.castShadow = true;
    this.group.add(pump);
    this.collisionSystem.addBox(45 - 0.7, 45 + 0.7, -4 - 0.5, -4 + 0.5, 2.4, 'gas_pump');

    // 3. Dealership Showroom Zone (South road at 0, 32)
    const dealerFloorMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6, // Luxury purple showroom
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.8
    });
    const dealerMarker = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 0.1, 32), dealerFloorMat);
    dealerMarker.position.set(0, 0.05, 30);
    this.group.add(dealerMarker);

    // Dealership Totem Sign
    const dealerTotem = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.0, 0.8), dealerFloorMat);
    dealerTotem.position.set(6, 3.0, 30);
    this.group.add(dealerTotem);
    this.collisionSystem.addBox(6 - 0.5, 6 + 0.5, 30 - 0.5, 30 + 0.5, 6.0, 'totem');
  }

  buildStreetFurnitureInstanced() {
    // High-performance InstancedMesh for street lamps & trees
    const lampPositions = [
      { x: -14, z: -35 }, { x: 14, z: -35 },
      { x: -14, z: 35 }, { x: 14, z: 35 },
      { x: -35, z: -14 }, { x: -35, z: 14 },
      { x: 35, z: -14 }, { x: 35, z: 14 }
    ];

    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.2 });
    const lampInstMesh = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
    lampInstMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    lampPositions.forEach((pos, idx) => {
      dummy.position.set(pos.x, 2.75, pos.z);
      dummy.updateMatrix();
      lampInstMesh.setMatrixAt(idx, dummy.matrix);
      this.collisionSystem.addBox(pos.x - 0.4, pos.x + 0.4, pos.z - 0.4, pos.z + 0.4, 5.5, 'pole');
    });
    lampInstMesh.instanceMatrix.needsUpdate = true;
    this.group.add(lampInstMesh);
    this.detailObjects.push(lampInstMesh);

    // Trees Instanced Mesh (trunk + foliage)
    const treePositions = [
      { x: -16, z: -55 }, { x: -16, z: -75 },
      { x: 16, z: -55 }, { x: 16, z: -75 },
      { x: -16, z: 55 }, { x: -16, z: 75 },
      { x: 16, z: 55 }, { x: 16, z: 75 },
      { x: -55, z: -16 }, { x: -75, z: -16 },
      { x: 55, z: -16 }, { x: 75, z: -16 },
      { x: -55, z: 16 }, { x: -75, z: 16 },
      { x: 55, z: 16 }, { x: 75, z: 16 }
    ];

    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3.2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);

    const foliageGeo = new THREE.DodecahedronGeometry(1.8, 1);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, treePositions.length);

    treePositions.forEach((tp, idx) => {
      dummy.position.set(tp.x, 1.6, tp.z);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tp.x, 4.0, tp.z);
      dummy.updateMatrix();
      foliageInst.setMatrixAt(idx, dummy.matrix);

      this.collisionSystem.addBox(tp.x - 0.6, tp.x + 0.6, tp.z - 0.6, tp.z + 0.6, 4.0, 'tree');
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    foliageInst.instanceMatrix.needsUpdate = true;
    this.group.add(trunkInst);
    this.group.add(foliageInst);

    this.detailObjects.push(trunkInst);
    this.detailObjects.push(foliageInst);
  }

  setDetailLevel(presetName) {
    const showDetails = presetName !== 'LOW';
    this.detailObjects.forEach(obj => {
      if (obj) obj.visible = showDetails;
    });

    // On Low, disable shadow casting on buildings
    const castBuildingShadows = presetName === 'HIGH';
    this.buildingMeshes.forEach(b => {
      b.castShadow = castBuildingShadows;
    });
  }
}
