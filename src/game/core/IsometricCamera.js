import * as THREE from 'three';
import { DeviceDetector } from './DeviceDetector.js';

export class IsometricCamera {
  constructor(aspectRatio) {
    this.camera = new THREE.PerspectiveCamera(40, aspectRatio, 1, 1000);

    // Camera view modes: 'isometric' (classic elevated diagonal) | 'chase' (close automotive 3rd person)
    this.viewMode = 'isometric';

    // Standard isometric diagonal offset (isometric vector)
    this.distance = 42;
    this.height = 36;
    this.offset = new THREE.Vector3(26, this.height, 26);

    this.currentPosition = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();

    // Lerp damping factors (smoother follow)
    this.positionSmoothness = 4.5;
    this.targetSmoothness = 6.0;

    // Mobile framing adjustment factor
    this.mobileScale = 1.0;
    this.checkMobileFraming();
  }

  checkMobileFraming() {
    const isMobile = DeviceDetector.isMobile();
    const isPortrait = !DeviceDetector.isLandscape();

    if (isPortrait) {
      // In portrait mode, vehicle needs more vertical field of view
      this.camera.fov = 52;
      this.mobileScale = 1.35; // pull camera slightly further back
    } else if (isMobile) {
      // Mobile landscape
      this.camera.fov = 42;
      this.mobileScale = 1.15;
    } else {
      // Desktop
      this.camera.fov = 40;
      this.mobileScale = 1.0;
    }
    this.camera.updateProjectionMatrix();
  }

  init(targetPosition) {
    this.currentTarget.copy(targetPosition);
    this.currentPosition.copy(targetPosition).add(
      new THREE.Vector3().copy(this.offset).multiplyScalar(this.mobileScale)
    );
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentTarget);
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'isometric' ? 'chase' : 'isometric';
    return this.viewMode;
  }

  update(dt, targetPosition, vehicleSpeed, vehicleHeading) {
    const forwardX = -Math.sin(vehicleHeading);
    const forwardZ = -Math.cos(vehicleHeading);

    if (this.viewMode === 'chase') {
      // Dynamic behind-the-car 3rd person chase camera
      const chaseDistance = 14 * this.mobileScale;
      const chaseHeight = 5.5 * this.mobileScale;

      const desiredPos = new THREE.Vector3(
        targetPosition.x - forwardX * chaseDistance,
        targetPosition.y + chaseHeight,
        targetPosition.z - forwardZ * chaseDistance
      );

      const desiredTarget = new THREE.Vector3(
        targetPosition.x + forwardX * 6,
        targetPosition.y + 1.2,
        targetPosition.z + forwardZ * 6
      );

      this.currentTarget.lerp(desiredTarget, THREE.MathUtils.clamp(8.0 * dt, 0, 1));
      this.currentPosition.lerp(desiredPos, THREE.MathUtils.clamp(6.0 * dt, 0, 1));

      this.camera.position.copy(this.currentPosition);
      this.camera.lookAt(this.currentTarget);
      return;
    }

    // Default: Isometric View Mode
    const leadDistance = Math.min(Math.abs(vehicleSpeed) * 0.28, 7.0);

    const desiredTarget = new THREE.Vector3(
      targetPosition.x + forwardX * (vehicleSpeed >= 0 ? leadDistance : -leadDistance * 0.5),
      targetPosition.y + 0.8,
      targetPosition.z + forwardZ * (vehicleSpeed >= 0 ? leadDistance : -leadDistance * 0.5)
    );

    // Smooth target follow
    this.currentTarget.lerp(desiredTarget, THREE.MathUtils.clamp(this.targetSmoothness * dt, 0, 1));

    // Dynamic zoom slightly out when driving at high speed
    const speedZoom = (Math.abs(vehicleSpeed) / 40.0) * 8.0;
    const dynamicOffset = new THREE.Vector3(
      (this.offset.x + (this.offset.x / this.distance) * speedZoom) * this.mobileScale,
      (this.offset.y + (this.offset.y / this.distance) * speedZoom * 0.8) * this.mobileScale,
      (this.offset.z + (this.offset.z / this.distance) * speedZoom) * this.mobileScale
    );

    const desiredPosition = new THREE.Vector3().copy(this.currentTarget).add(dynamicOffset);

    // Smooth position follow
    this.currentPosition.lerp(desiredPosition, THREE.MathUtils.clamp(this.positionSmoothness * dt, 0, 1));

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentTarget);
  }

  onResize(aspectRatio) {
    this.camera.aspect = aspectRatio;
    this.checkMobileFraming();
  }
}
