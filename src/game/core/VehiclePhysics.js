import * as THREE from 'three';

export class VehiclePhysics {
  constructor() {
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.heading = 0; // In radians (yaw angle around Y axis)
    this.speed = 0; // Scalar forward speed in units/s (negative for reverse)
    this.steerAngle = 0;

    // Vehicle tuning parameters
    this.maxForwardSpeed = 38.0; // ~136 km/h scale
    this.maxReverseSpeed = -12.0;
    this.acceleration = 24.0;
    this.reverseAcceleration = 14.0;
    this.brakingPower = 38.0;
    this.handbrakeDeceleration = 50.0;
    this.naturalDeceleration = 6.0; // rolling resistance
    this.maxSteerAngle = 0.58; // ~33 degrees
    this.steerSpeed = 3.2;
    this.steerReturnSpeed = 4.8;
    this.wheelbase = 2.6; // distance between axles

    // Lateral grip and drift
    this.driftFactor = 0.94; // grip retention
    this.angularVelocity = 0;

    // Collision bounding box (half dimensions: length/2, width/2)
    this.length = 4.4;
    this.width = 2.0;
    this.radius = 2.2; // bounding circle approximation for fast broadphase
  }

  update(dt, input, collisionSystem) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1); // clamp delta time to prevent physics tunnel/explosion

    // 1. Steering input handling
    let targetSteer = 0;
    if (input.left) targetSteer += this.maxSteerAngle;
    if (input.right) targetSteer -= this.maxSteerAngle;

    // Steering speed damping at high speeds
    const speedRatio = Math.min(Math.abs(this.speed) / this.maxForwardSpeed, 1.0);
    const effectiveMaxSteer = this.maxSteerAngle * (1.0 - speedRatio * 0.45);
    targetSteer = THREE.MathUtils.clamp(targetSteer, -effectiveMaxSteer, effectiveMaxSteer);

    if (targetSteer !== 0) {
      this.steerAngle = THREE.MathUtils.damp(this.steerAngle, targetSteer, this.steerSpeed, dt);
    } else {
      this.steerAngle = THREE.MathUtils.damp(this.steerAngle, 0, this.steerReturnSpeed, dt);
    }

    // 2. Acceleration / Braking
    const isMovingForward = this.speed > 0.1;
    const isMovingBackward = this.speed < -0.1;

    if (input.handbrake) {
      // Handbrake active
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.handbrakeDeceleration * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.handbrakeDeceleration * dt);
      }
    } else {
      if (input.forward) {
        if (this.speed < 0) {
          // Braking from reverse
          this.speed += this.brakingPower * dt;
        } else {
          // Accelerating forward
          this.speed = Math.min(this.maxForwardSpeed, this.speed + this.acceleration * dt);
        }
      } else if (input.backward) {
        if (this.speed > 0) {
          // Braking while moving forward
          this.speed = Math.max(0, this.speed - this.brakingPower * dt);
        } else {
          // Reversing
          this.speed = Math.max(this.maxReverseSpeed, this.speed - this.reverseAcceleration * dt);
        }
      } else {
        // Coasting / natural rolling resistance
        if (this.speed > 0) {
          this.speed = Math.max(0, this.speed - this.naturalDeceleration * dt);
        } else if (this.speed < 0) {
          this.speed = Math.min(0, this.speed + this.naturalDeceleration * dt);
        }
      }
    }

    // 3. Bicycle Model Yaw Update
    if (Math.abs(this.speed) > 0.05) {
      // Angular velocity = (speed / wheelbase) * tan(steerAngle)
      let turnRate = (this.speed / this.wheelbase) * Math.tan(this.steerAngle);
      if (input.handbrake && Math.abs(this.speed) > 5.0) {
        // Handbrake drift boost
        turnRate *= 1.6;
      }
      this.heading += turnRate * dt;
    }

    // Keep heading normalized between -PI and PI
    this.heading = (this.heading + Math.PI) % (Math.PI * 2) - Math.PI;

    // 4. Compute candidate movement vector
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);

    const deltaX = forwardX * this.speed * dt;
    const deltaZ = forwardZ * this.speed * dt;

    // 5. Collision detection and response with world obstacles
    const nextPos = new THREE.Vector3(
      this.position.x + deltaX,
      this.position.y,
      this.position.z + deltaZ
    );

    if (collisionSystem) {
      const collisionResult = collisionSystem.checkAndResolve(this.position, nextPos, this.radius);
      if (collisionResult.collided) {
        this.position.copy(collisionResult.resolvedPosition);
        // Reduce speed upon impact and simulate bounce/rebound
        this.speed *= -0.35;
      } else {
        this.position.copy(nextPos);
      }
    } else {
      this.position.copy(nextPos);
    }
  }

  getKmh() {
    return Math.abs(Math.round(this.speed * 3.6));
  }

  getGear() {
    if (this.speed < -0.2) return 'R';
    if (Math.abs(this.speed) <= 0.2) return 'N';
    const kmh = this.getKmh();
    if (kmh < 25) return '1';
    if (kmh < 50) return '2';
    if (kmh < 75) return '3';
    if (kmh < 105) return '4';
    return '5';
  }

  getRpm() {
    const kmh = this.getKmh();
    if (this.getGear() === 'N') return 900;
    const gearRatios = { '1': 25, '2': 50, '3': 75, '4': 105, '5': 140, 'R': 30 };
    const maxKmhForGear = gearRatios[this.getGear()] || 50;
    const ratio = (kmh % maxKmhForGear) / maxKmhForGear;
    return Math.min(7200, Math.round(1200 + ratio * 5500));
  }
}
