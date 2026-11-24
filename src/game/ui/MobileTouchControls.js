import { DeviceDetector } from '../core/DeviceDetector.js';

export class MobileTouchControls {
  constructor(engine) {
    this.engine = engine;
    this.input = engine.input;

    // Load persistent touch preferences
    this.prefs = this.loadPreferences();

    // Active touch pointer tracking to prevent stuck states
    this.activePointers = new Map();

    // Joystick tracking state
    this.joystickState = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    };

    this.container = document.createElement('div');
    this.container.id = 'uml-touch-controls';
    this.buildUI();
    document.body.appendChild(this.container);

    this.bindEvents();
    this.applyPreferences();

    // Auto visibility based on device detection or explicit user setting
    this.updateVisibility();
    window.addEventListener('resize', () => this.updateVisibility());
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem('uml_touch_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load touch settings:', e);
    }
    return {
      enabled: 'auto', // 'auto' | 'always' | 'never'
      steeringMode: 'buttons', // 'buttons' | 'joystick'
      opacity: 0.65,
      buttonSize: 'medium', // 'small' | 'medium' | 'large'
      layout: 'landscape' // 'landscape' | 'portrait'
    };
  }

  savePreferences() {
    try {
      localStorage.setItem('uml_touch_settings', JSON.stringify(this.prefs));
    } catch (e) {
      console.warn('Failed to save touch settings:', e);
    }
  }

  buildUI() {
    this.container.innerHTML = `
      <style>
        #uml-touch-controls {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 150;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
          display: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* Safe Area Padding for Modern Android / Notches */
        .touch-zone-left {
          position: absolute;
          bottom: max(24px, env(safe-area-inset-bottom, 24px));
          left: max(20px, env(safe-area-inset-left, 20px));
          display: flex;
          align-items: center;
          gap: 16px;
          pointer-events: auto;
        }

        .touch-zone-right {
          position: absolute;
          bottom: max(24px, env(safe-area-inset-bottom, 24px));
          right: max(20px, env(safe-area-inset-right, 20px));
          display: flex;
          align-items: flex-end;
          gap: 16px;
          pointer-events: auto;
        }

        .touch-zone-actions {
          position: absolute;
          top: max(24px, env(safe-area-inset-top, 24px));
          right: max(20px, env(safe-area-inset-right, 20px));
          display: flex;
          gap: 12px;
          pointer-events: auto;
        }

        /* Base Touch Button */
        .touch-btn {
          background: rgba(15, 23, 42, var(--btn-opacity, 0.65));
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1.5px solid rgba(255, 255, 255, 0.22);
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #f8fafc;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          transition: transform 0.08s ease, background-color 0.08s ease, border-color 0.08s ease;
          touch-action: none;
          cursor: pointer;
        }

        .touch-btn:active, .touch-btn.active {
          background: rgba(56, 189, 248, 0.45);
          border-color: #38bdf8;
          transform: scale(0.92);
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.6);
        }

        /* Button Size Variations */
        .btn-size-small { width: 56px; height: 56px; font-size: 11px; }
        .btn-size-medium { width: 68px; height: 68px; font-size: 13px; }
        .btn-size-large { width: 80px; height: 80px; font-size: 15px; }

        /* Specific Touch Button Shapes */
        .touch-btn-pedal {
          border-radius: 20px;
        }
        .pedal-size-small { width: 58px; height: 90px; }
        .pedal-size-medium { width: 70px; height: 110px; }
        .pedal-size-large { width: 84px; height: 130px; }

        .touch-btn-small {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .touch-icon {
          width: 24px;
          height: 24px;
          fill: currentColor;
          pointer-events: none;
        }

        .touch-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-top: 2px;
          pointer-events: none;
        }

        /* Virtual Joystick */
        .virtual-joystick-base {
          width: 140px;
          height: 140px;
          background: rgba(15, 23, 42, var(--btn-opacity, 0.6));
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          position: relative;
          touch-action: none;
          display: none;
          align-items: center;
          justify-content: center;
        }

        .virtual-joystick-thumb {
          width: 54px;
          height: 54px;
          background: #38bdf8;
          border: 2px solid #ffffff;
          border-radius: 50%;
          position: absolute;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          transform: translate(0, 0);
          pointer-events: none;
          transition: transform 0.05s ease-out;
        }

        /* Portrait layout adjustments */
        @media (orientation: portrait) {
          .touch-zone-left {
            bottom: max(32px, env(safe-area-inset-bottom, 32px));
            left: 16px;
          }
          .touch-zone-right {
            bottom: max(32px, env(safe-area-inset-bottom, 32px));
            right: 16px;
          }
        }
      </style>

      <!-- Steering Control (Left) -->
      <div class="touch-zone-left">
        <!-- Buttons Mode -->
        <div id="steering-buttons-group" style="display: flex; gap: 14px;">
          <button id="btn-steer-left" class="touch-btn touch-btn-steer" data-action="left" aria-label="Steer Left">
            <svg class="touch-icon" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            <span class="touch-label">Left</span>
          </button>
          <button id="btn-steer-right" class="touch-btn touch-btn-steer" data-action="right" aria-label="Steer Right">
            <svg class="touch-icon" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            <span class="touch-label">Right</span>
          </button>
        </div>

        <!-- Virtual Joystick Mode -->
        <div id="virtual-joystick-base" class="virtual-joystick-base">
          <div id="virtual-joystick-thumb" class="virtual-joystick-thumb"></div>
        </div>
      </div>

      <!-- Driving Pedals & Handbrake (Right) -->
      <div class="touch-zone-right">
        <!-- Handbrake Button -->
        <button id="btn-handbrake" class="touch-btn touch-btn-pedal" data-action="handbrake" style="height: 64px; align-self: center;" aria-label="Handbrake">
          <svg class="touch-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2v-2zm0-10h2v8h-2V6z"/></svg>
          <span class="touch-label">Drift</span>
        </button>

        <!-- Brake / Reverse Pedal -->
        <button id="btn-brake" class="touch-btn touch-btn-pedal" data-action="backward" aria-label="Brake and Reverse">
          <svg class="touch-icon" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          <span class="touch-label">Brake</span>
        </button>

        <!-- Accelerator Pedal -->
        <button id="btn-gas" class="touch-btn touch-btn-pedal" data-action="forward" style="background: rgba(34, 197, 94, 0.45); border-color: rgba(74, 222, 128, 0.6);" aria-label="Accelerate">
          <svg class="touch-icon" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
          <span class="touch-label" style="color: #4ade80;">Gas</span>
        </button>
      </div>

      <!-- Quick Action Controls (Top Right) -->
      <div class="touch-zone-actions">
        <button id="btn-camera" class="touch-btn touch-btn-small" aria-label="Switch Camera">
          <span>CAM</span>
        </button>
        <button id="btn-interact" class="touch-btn touch-btn-small" style="background: rgba(56, 189, 248, 0.4); border-color: #38bdf8;" aria-label="Interact">
          <span>E</span>
        </button>
        <button id="btn-settings-touch" class="touch-btn touch-btn-small" aria-label="Touch & Graphics Settings">
          <span>⚙</span>
        </button>
      </div>
    `;

    this.btnLeft = this.container.querySelector('#btn-steer-left');
    this.btnRight = this.container.querySelector('#btn-steer-right');
    this.btnGas = this.container.querySelector('#btn-gas');
    this.btnBrake = this.container.querySelector('#btn-brake');
    this.btnHandbrake = this.container.querySelector('#btn-handbrake');
    this.btnCamera = this.container.querySelector('#btn-camera');
    this.btnInteract = this.container.querySelector('#btn-interact');
    this.btnSettings = this.container.querySelector('#btn-settings-touch');

    this.steeringButtonsGroup = this.container.querySelector('#steering-buttons-group');
    this.joystickBase = this.container.querySelector('#virtual-joystick-base');
    this.joystickThumb = this.container.querySelector('#virtual-joystick-thumb');
  }

  updateVisibility() {
    const isMobileDevice = DeviceDetector.isTouchDevice();
    const shouldShow =
      this.prefs.enabled === 'always' ||
      (this.prefs.enabled === 'auto' && isMobileDevice);

    this.container.style.display = shouldShow ? 'block' : 'none';
  }

  applyPreferences() {
    this.container.style.setProperty('--btn-opacity', this.prefs.opacity);

    // Apply button sizes
    const size = this.prefs.buttonSize || 'medium';
    const steerButtons = [this.btnLeft, this.btnRight];
    steerButtons.forEach(btn => {
      btn.className = `touch-btn touch-btn-steer btn-size-${size}`;
    });

    const pedals = [this.btnGas, this.btnBrake];
    pedals.forEach(p => {
      p.className = `touch-btn touch-btn-pedal pedal-size-${size}`;
    });

    // Apply steering mode
    if (this.prefs.steeringMode === 'joystick') {
      this.steeringButtonsGroup.style.display = 'none';
      this.joystickBase.style.display = 'flex';
    } else {
      this.steeringButtonsGroup.style.display = 'flex';
      this.joystickBase.style.display = 'none';
    }

    this.updateVisibility();
  }

  bindEvents() {
    // 1. Pedal and Steering Action Buttons with Pointer Events
    const actionButtons = [
      { element: this.btnLeft, action: 'left' },
      { element: this.btnRight, action: 'right' },
      { element: this.btnGas, action: 'forward' },
      { element: this.btnBrake, action: 'backward' },
      { element: this.btnHandbrake, action: 'handbrake' }
    ];

    actionButtons.forEach(({ element, action }) => {
      if (!element) return;

      const onPointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.setPointerCapture(e.pointerId);
        element.classList.add('active');
        this.activePointers.set(e.pointerId, { action, element });
        this.input.setTouchDrive(action, true);
      };

      const onPointerUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (element.hasPointerCapture(e.pointerId)) {
          element.releasePointerCapture(e.pointerId);
        }
        element.classList.remove('active');
        this.activePointers.delete(e.pointerId);
        this.input.setTouchDrive(action, false);
      };

      const onPointerCancel = (e) => {
        onPointerUp(e);
      };

      element.addEventListener('pointerdown', onPointerDown);
      element.addEventListener('pointerup', onPointerUp);
      element.addEventListener('pointercancel', onPointerCancel);
    });

    // 2. Action Buttons (Camera, Interact, Settings)
    this.btnCamera.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.engine.toggleCameraView();
    });

    this.btnInteract.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.engine.handleInteractionKey();
    });

    this.btnSettings.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.engine.modals) {
        this.engine.modals.openInputSettings();
      }
    });

    // 3. Virtual Joystick Events
    this.bindJoystickEvents();

    // 4. Global window pointer cancel/up safeguards to completely eliminate stuck touch inputs
    window.addEventListener('pointerup', () => this.clearAllTouches());
    window.addEventListener('pointercancel', () => this.clearAllTouches());
    window.addEventListener('blur', () => this.clearAllTouches());
  }

  bindJoystickEvents() {
    const base = this.joystickBase;
    const thumb = this.joystickThumb;
    const maxRadius = 45; // max thumb travel in px

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      base.setPointerCapture(e.pointerId);

      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      this.joystickState.active = true;
      this.joystickState.pointerId = e.pointerId;
      this.joystickState.startX = centerX;
      this.joystickState.startY = centerY;

      this.handleJoystickMove(e.clientX, e.clientY, maxRadius);
    };

    const onPointerMove = (e) => {
      if (!this.joystickState.active || e.pointerId !== this.joystickState.pointerId) return;
      e.preventDefault();
      this.handleJoystickMove(e.clientX, e.clientY, maxRadius);
    };

    const onPointerUp = (e) => {
      if (e.pointerId !== this.joystickState.pointerId) return;
      e.preventDefault();
      if (base.hasPointerCapture(e.pointerId)) {
        base.releasePointerCapture(e.pointerId);
      }
      this.joystickState.active = false;
      this.joystickState.pointerId = null;
      thumb.style.transform = `translate(0px, 0px)`;
      this.input.setAnalogSteer(0);
    };

    base.addEventListener('pointerdown', onPointerDown);
    base.addEventListener('pointermove', onPointerMove);
    base.addEventListener('pointerup', onPointerUp);
    base.addEventListener('pointercancel', onPointerUp);
  }

  handleJoystickMove(clientX, clientY, maxRadius) {
    const deltaX = clientX - this.joystickState.startX;
    const deltaY = clientY - this.joystickState.startY;

    const distance = Math.hypot(deltaX, deltaY);
    const clampedDist = Math.min(distance, maxRadius);
    const angle = Math.atan2(deltaY, deltaX);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    this.joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

    // Horizontal ratio (-1.0 to 1.0)
    // Left on screen is negative X, so steering left is positive analog
    const normX = -thumbX / maxRadius;
    this.input.setAnalogSteer(normX);
  }

  clearAllTouches() {
    this.activePointers.forEach(({ element, action }) => {
      if (element) element.classList.remove('active');
      this.input.setTouchDrive(action, false);
    });
    this.activePointers.clear();

    if (this.joystickState.active) {
      this.joystickState.active = false;
      this.joystickState.pointerId = null;
      if (this.joystickThumb) {
        this.joystickThumb.style.transform = `translate(0px, 0px)`;
      }
      this.input.setAnalogSteer(0);
    }
  }

  dispose() {
    this.clearAllTouches();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
