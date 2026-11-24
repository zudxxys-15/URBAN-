import * as THREE from 'three';

export class Car {
  constructor(vehicleData = null) {
    this.mesh = new THREE.Group();
    this.wheels = [];
    this.frontWheels = [];
    this.spoilerMesh = null;
    this.spoilerStands = [];

    // Shared geometry and materials for performance & customization
    this.data = vehicleData || {
      id: 'coupe_r3',
      name: 'Veloce Spectre Coupe',
      color: '#1f2937',
      rimStyle: 'chrome',
      spoilerType: 'sport',
      engineStage: 1,
      suspensionStage: 1
    };

    this.initMaterials();
    this.buildCarModel();
    this.applyCustomization(this.data);
  }

  initMaterials() {
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.data.color || '#1f2937'),
      roughness: 0.28,
      metalness: 0.82
    });

    this.roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.2,
      metalness: 0.9
    });

    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.8,
      metalness: 0.2
    });

    this.glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.95
    });

    this.tireMaterial = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.8,
      metalness: 0.1
    });

    this.rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.3,
      metalness: 0.9
    });

    this.headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    this.taillightMaterial = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  }

  buildCarModel() {
    // 1. Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(1.9, 0.45, 4.3);
    const chassis = new THREE.Mesh(chassisGeo, this.bodyMaterial);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.mesh.add(chassis);

    // Front splitter & Rear diffuser
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 0.5), this.trimMaterial);
    splitter.position.set(0, 0.26, -2.15);
    this.mesh.add(splitter);

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.4), this.trimMaterial);
    diffuser.position.set(0, 0.3, 2.15);
    this.mesh.add(diffuser);

    // 2. Cabin / Greenhouse
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.2), this.roofMaterial);
    cabin.position.set(0, 0.92, 0.15);
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // Windshields
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.48, 0.55), this.glassMaterial);
    windshield.position.set(0, 0.88, -0.92);
    windshield.rotation.x = -Math.PI / 8;
    this.mesh.add(windshield);

    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.48, 0.55), this.glassMaterial);
    rearWindow.position.set(0, 0.88, 1.2);
    rearWindow.rotation.x = Math.PI / 7;
    this.mesh.add(rearWindow);

    const sideWindows = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.38, 1.4), this.glassMaterial);
    sideWindows.position.set(0, 0.92, 0.15);
    this.mesh.add(sideWindows);

    // 3. Hood & Trunk
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.3), this.bodyMaterial);
    hood.position.set(0, 0.72, -1.35);
    hood.castShadow = true;
    this.mesh.add(hood);

    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.24, 0.9), this.bodyMaterial);
    trunk.position.set(0, 0.72, 1.6);
    trunk.castShadow = true;
    this.mesh.add(trunk);

    // 4. Lights
    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), this.headlightMaterial);
    hlLeft.position.set(-0.62, 0.58, -2.16);
    this.mesh.add(hlLeft);

    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), this.headlightMaterial);
    hlRight.position.set(0.62, 0.58, -2.16);
    this.mesh.add(hlRight);

    const taillight = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.06), this.taillightMaterial);
    taillight.position.set(0, 0.62, 2.16);
    this.mesh.add(taillight);

    // 5. Wheels & Rims
    const wheelRadius = 0.38;
    const wheelWidth = 0.28;
    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20);
    tireGeo.rotateZ(Math.PI / 2);

    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 12);
    rimGeo.rotateZ(Math.PI / 2);

    const wheelOffsets = [
      { x: -0.96, y: wheelRadius, z: -1.35, isFront: true },
      { x: 0.96, y: wheelRadius, z: -1.35, isFront: true },
      { x: -0.96, y: wheelRadius, z: 1.35, isFront: false },
      { x: 0.96, y: wheelRadius, z: 1.35, isFront: false }
    ];

    wheelOffsets.forEach((cfg) => {
      const wheelMount = new THREE.Group();
      wheelMount.position.set(cfg.x, cfg.y, cfg.z);

      const wheelRotator = new THREE.Group();
      const tireMesh = new THREE.Mesh(tireGeo, this.tireMaterial);
      tireMesh.castShadow = true;
      wheelRotator.add(tireMesh);

      const rimMesh = new THREE.Mesh(rimGeo, this.rimMaterial);
      wheelRotator.add(rimMesh);

      wheelMount.add(wheelRotator);
      this.mesh.add(wheelMount);

      const wheelObj = { mount: wheelMount, rotator: wheelRotator, isFront: cfg.isFront };
      this.wheels.push(wheelObj);
      if (cfg.isFront) this.frontWheels.push(wheelObj);
    });

    // 6. Contact Shadow
    const shadowGeo = new THREE.PlaneGeometry(2.4, 4.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    this.mesh.add(shadowMesh);
  }

  applyCustomization(vehicleData) {
    this.data = { ...this.data, ...vehicleData };

    // 1. Paint Color
    if (this.data.color) {
      this.bodyMaterial.color.set(this.data.color);
    }

    // 2. Rims
    if (this.data.rimStyle === 'gold') {
      this.rimMaterial.color.set(0xeab308);
      this.rimMaterial.roughness = 0.35;
      this.rimMaterial.metalness = 0.95;
    } else if (this.data.rimStyle === 'matte_black') {
      this.rimMaterial.color.set(0x18181b);
      this.rimMaterial.roughness = 0.8;
      this.rimMaterial.metalness = 0.2;
    } else {
      // Chrome
      this.rimMaterial.color.set(0xd4d4d8);
      this.rimMaterial.roughness = 0.25;
      this.rimMaterial.metalness = 0.9;
    }

    // 3. Spoilers
    if (this.spoilerMesh) {
      this.mesh.remove(this.spoilerMesh);
      this.spoilerMesh = null;
    }
    this.spoilerStands.forEach(s => this.mesh.remove(s));
    this.spoilerStands = [];

    if (this.data.spoilerType === 'gt_wing') {
      const wingGeo = new THREE.BoxGeometry(1.85, 0.08, 0.42);
      this.spoilerMesh = new THREE.Mesh(wingGeo, this.trimMaterial);
      this.spoilerMesh.position.set(0, 1.15, 2.05);
      this.spoilerMesh.castShadow = true;
      this.mesh.add(this.spoilerMesh);

      const standL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.15), this.trimMaterial);
      standL.position.set(-0.65, 0.95, 2.05);
      const standR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.15), this.trimMaterial);
      standR.position.set(0.65, 0.95, 2.05);
      this.mesh.add(standL);
      this.mesh.add(standR);
      this.spoilerStands.push(standL, standR);
    } else if (this.data.spoilerType === 'sport') {
      const wingGeo = new THREE.BoxGeometry(1.7, 0.06, 0.3);
      this.spoilerMesh = new THREE.Mesh(wingGeo, this.trimMaterial);
      this.spoilerMesh.position.set(0, 0.96, 2.05);
      this.spoilerMesh.castShadow = true;
      this.mesh.add(this.spoilerMesh);

      const standL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), this.trimMaterial);
      standL.position.set(-0.55, 0.85, 2.05);
      const standR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), this.trimMaterial);
      standR.position.set(0.55, 0.85, 2.05);
      this.mesh.add(standL);
      this.mesh.add(standR);
      this.spoilerStands.push(standL, standR);
    }
  }

  update(physics, dt) {
    this.mesh.position.copy(physics.position);
    this.mesh.rotation.y = physics.heading;

    const rollAngle = (physics.speed / physics.maxForwardSpeed) * (physics.steerAngle * -0.22);
    this.mesh.rotation.z = THREE.MathUtils.damp(this.mesh.rotation.z, rollAngle, 8.0, dt);

    this.frontWheels.forEach(w => {
      w.mount.rotation.y = physics.steerAngle;
    });

    const wheelRadius = 0.38;
    const angularSpeed = physics.speed / wheelRadius;
    this.wheels.forEach(w => {
      w.rotator.rotation.x += angularSpeed * dt;
    });
  }
}
