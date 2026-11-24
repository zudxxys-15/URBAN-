export class InputManager {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      handbrake: false
    };

    // Analog steering for virtual joystick or touch buttons (-1.0 to 1.0)
    this.analogSteer = 0;
    this.hasAnalogSteer = false;

    // Additional action callbacks
    this.onInteract = null;
    this.onSwitchCamera = null;
    this.onEnterExitVehicle = null;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onKeyDown(e) {
    if (e.repeat) return;
    this.setKey(e.code, true);

    if (e.code === 'KeyE') {
      if (this.onInteract) this.onInteract();
    } else if (e.code === 'KeyC') {
      if (this.onSwitchCamera) this.onSwitchCamera();
    } else if (e.code === 'KeyX') {
      if (this.onEnterExitVehicle) this.onEnterExitVehicle();
    }
  }

  onKeyUp(e) {
    this.setKey(e.code, false);
  }

  setKey(code, isPressed) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isPressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isPressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isPressed;
        this.hasAnalogSteer = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isPressed;
        this.hasAnalogSteer = false;
        break;
      case 'Space':
        this.keys.handbrake = isPressed;
        break;
      default:
        break;
    }
  }

  // Mobile Touch API
  setTouchDrive(action, isPressed) {
    if (action === 'forward') {
      this.keys.forward = isPressed;
    } else if (action === 'backward') {
      this.keys.backward = isPressed;
    } else if (action === 'handbrake') {
      this.keys.handbrake = isPressed;
    } else if (action === 'left') {
      this.keys.left = isPressed;
      this.hasAnalogSteer = false;
    } else if (action === 'right') {
      this.keys.right = isPressed;
      this.hasAnalogSteer = false;
    }
  }

  setAnalogSteer(value) {
    this.analogSteer = Math.max(-1.0, Math.min(1.0, value));
    this.hasAnalogSteer = Math.abs(this.analogSteer) > 0.02;
    if (!this.hasAnalogSteer) {
      this.keys.left = false;
      this.keys.right = false;
    } else {
      this.keys.left = this.analogSteer > 0.1;
      this.keys.right = this.analogSteer < -0.1;
    }
  }

  reset() {
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.handbrake = false;
    this.analogSteer = 0;
    this.hasAnalogSteer = false;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
