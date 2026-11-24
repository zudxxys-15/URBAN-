import * as THREE from 'three';

export class IsometricCamera {
  constructor(aspectRatio) {
    // True dimetric / isometric perspective with smooth tracking
    // We use a high FOV PerspectiveCamera placed at a classic 45 degree angle and elevated
    // with smooth lerp tracking to preserve depth and realistic lighting while maintaining isometric composition
    this.camera = new THREE.PerspectiveCamera(40, aspectRatio, 1, 1000);

    // Standard isometric diagonal offset (isometric vector)
    this.distance = 42;
    this.height = 36;
    this.offset = new THREE.Vector3(26, this.height, 26);

    this.currentPosition = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();

    // Lerp damping factors (smoother follow)
    this.positionSmoothness = 4.5;
    this.targetSmoothness = 6.0;
  }

  init(targetPosition) {
    this.currentTarget.copy(targetPosition);
    this.currentPosition.copy(targetPosition).add(this.offset);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentTarget);
  }

  update(dt, targetPosition, vehicleSpeed, vehicleHeading) {
    // Dynamic camera lead: pull camera slightly ahead based on vehicle forward direction
    const leadDistance = Math.min(Math.abs(vehicleSpeed) * 0.28, 7.0);
    const forwardX = -Math.sin(vehicleHeading);
    const forwardZ = -Math.cos(vehicleHeading);

    const desiredTarget = new THREE.Vector3(
      targetPosition.x + forwardX * (vehicleSpeed >= 0 ? leadDistance : -leadDistance * 0.5),
      targetPosition.y + 0.8,
      targetPosition.z + forwardZ * (vehicleSpeed >= 0 ? leadDistance : -leadDistance * 0.5)
    );

    // Smooth target follow
    this.currentTarget.lerp(desiredTarget, THREE.MathUtils.clamp(this.targetSmoothness * dt, 0, 1));

    // Dynamic zoom slightly out when driving at high speed for improved city visibility
    const speedZoom = (Math.abs(vehicleSpeed) / 40.0) * 8.0;
    const dynamicOffset = new THREE.Vector3(
      this.offset.x + (this.offset.x / this.distance) * speedZoom,
      this.offset.y + (this.offset.y / this.distance) * speedZoom * 0.8,
      this.offset.z + (this.offset.z / this.distance) * speedZoom
    );

    const desiredPosition = new THREE.Vector3().copy(this.currentTarget).add(dynamicOffset);

    // Smooth position follow
    this.currentPosition.lerp(desiredPosition, THREE.MathUtils.clamp(this.positionSmoothness * dt, 0, 1));

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentTarget);
  }

  onResize(aspectRatio) {
    this.camera.aspect = aspectRatio;
    this.camera.updateProjectionMatrix();
  }
}
