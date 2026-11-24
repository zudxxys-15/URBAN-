import * as THREE from 'three';
import { DeviceDetector } from './core/DeviceDetector.js';
import { InputManager } from './core/InputManager.js';
import { VehiclePhysics } from './core/VehiclePhysics.js';
import { CollisionSystem } from './core/CollisionSystem.js';
import { IsometricCamera } from './core/IsometricCamera.js';
import { PerformanceMonitor } from './core/PerformanceMonitor.js';
import { GraphicsQualityManager } from './core/GraphicsQualityManager.js';
import { SaveSystem } from './core/SaveSystem.js';
import { EconomySystem } from './core/EconomySystem.js';
import { FuelSystem } from './core/FuelSystem.js';
import { Car } from './entities/Car.js';
import { UrbanEnvironment } from './world/UrbanEnvironment.js';
import { WorldPolish } from './world/WorldPolish.js';
import { TrafficSystem } from './core/TrafficSystem.js';
import { PedestrianSystem } from './core/PedestrianSystem.js';
import { DayNightCycle } from './core/DayNightCycle.js';
import { AudioSystem } from './core/AudioSystem.js';
import { AutomotiveHUD } from './ui/AutomotiveHUD.js';
import { ModalsManager } from './ui/ModalsManager.js';
import { MobileTouchControls } from './ui/MobileTouchControls.js';

export class GameEngine {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.isRunning = false;
    this.lastTime = performance.now();

    // 1. Device Context & Persistence
    this.isMobile = DeviceDetector.isMobile();
    this.saveData = SaveSystem.load();
    this.economy = new EconomySystem();
    this.fuelSystem = new FuelSystem(this.economy);

    this.currentVehicleData = this.saveData.ownedVehicles.find(
      v => v.id === this.saveData.currentVehicleId
    ) || this.saveData.ownedVehicles[0];

    // 2. High-Performance WebGL Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isMobile, // Disable MSAA on mobile for fillrate optimization
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1.0, this.isMobile ? 1.0 : 1.25));
    this.renderer.shadowMap.enabled = !this.isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.canvas = this.renderer.domElement;
    this.container.appendChild(this.canvas);

    // 3. Performance Monitor & Diagnostics (F3 Panel)
    this.perfMonitor = new PerformanceMonitor(this.renderer);

    // 4. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Daytime sky
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.004);

    // 5. Lighting Setup
    this.setupLighting();

    // 6. Subsystems
    this.input = new InputManager();
    this.collision = new CollisionSystem();
    this.physics = new VehiclePhysics();
    this.cameraController = new IsometricCamera(window.innerWidth / window.innerHeight);
    this.audio = new AudioSystem();

    this.hud = new AutomotiveHUD(this);
    this.modals = new ModalsManager(this);
    window.__UML_MODALS__ = this.modals;
    window.__UML_ENGINE__ = this;

    // 7. Mobile Touch Controls (Android / Mobile Responsive)
    this.touchControls = new MobileTouchControls(this);

    // Wire input callbacks
    this.input.onInteract = () => this.handleInteractionKey();
    this.input.onSwitchCamera = () => this.toggleCameraView();
    this.input.onEnterExitVehicle = () => this.handleInteractionKey();

    // 8. World Environment, World Polish & Player Car
    this.environment = new UrbanEnvironment(this.scene, this.collision);
    this.worldPolish = new WorldPolish(this.scene, this.collision);

    this.car = new Car(this.currentVehicleData);
    this.scene.add(this.car.mesh);

    // Spawn vehicle
    this.physics.position.set(0, 0, 0);
    this.physics.heading = 0;
    this.car.update(this.physics, 0);
    this.cameraController.init(this.physics.position);

    // 9. Day / Night Cycle (Morning start, dynamic sky/fog/lighting)
    this.dayNight = new DayNightCycle(this.scene, this.sunLight, this.hemiLight);
    this.dayNight.onNightStart = () => {
      this.car.setHeadlights(true);
      if (this.traffic) this.traffic.setHeadlights(true);
      if (this.worldPolish) this.worldPolish.setNightMode(true);
    };
    this.dayNight.onDayStart = () => {
      this.car.setHeadlights(false);
      if (this.traffic) this.traffic.setHeadlights(false);
      if (this.worldPolish) this.worldPolish.setNightMode(false);
    };

    // 10. AI Traffic & Pedestrian Living Systems
    this.traffic = new TrafficSystem(this.scene, this.collision);
    this.pedestrians = new PedestrianSystem(this.scene);

    // 11. Graphics Quality Manager
    this.graphicsQuality = new GraphicsQualityManager(this);
    if (this.isMobile && !localStorage.getItem('uml_graphics_settings')) {
      this.graphicsQuality.currentPreset = 'LOW';
    }
    this.graphicsQuality.applyPreset(this.graphicsQuality.currentPreset);

    // 12. Audio Auto-Unlock on first user gesture
    this.setupAudioUnlock();

    // 13. Event Listeners
    this.onResize = this.onResize.bind(this);
    this.animate = this.animate.bind(this);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(this.onResize, 150);
    });

    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);

    // Auto-Save periodically every 15 seconds
    this.lastAutoSave = performance.now();

    // Testing loop hooks
    this.setupTestingHooks();
  }

  setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.75);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.5);
    this.sunLight.position.set(50, 80, 40);
    this.sunLight.castShadow = !this.isMobile;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 220;

    const shadowDist = 65;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0004;

    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x60a5fa, 0.3);
    this.fillLight.position.set(-50, 40, -40);
    this.scene.add(this.fillLight);
  }

  setupAudioUnlock() {
    const unlock = () => {
      if (this.audio) {
        this.audio.init();
        this.audio.startAmbient();
      }
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  toggleAudio() {
    if (this.audio) {
      if (!this.audio._initialized) {
        this.audio.init();
        this.audio.startAmbient();
      }
      this.audio.setMuted(!this.audio.isMuted());
    }
  }

  setupTestingHooks() {
    window.render_game_to_text = () => {
      const metrics = this.perfMonitor.getMetrics();
      const state = {
        mode: this.modals.activeModal ? `modal_${this.modals.activeModal}` : 'driving',
        device: {
          isMobile: this.isMobile,
          isTouch: DeviceDetector.isTouchDevice(),
          isLandscape: DeviceDetector.isLandscape(),
          cameraMode: this.cameraController.viewMode
        },
        world: {
          time: this.dayNight.getTimeString(),
          period: this.dayNight.getPeriod(),
          hours: Number(this.dayNight.getHours().toFixed(2)),
          isNight: this.dayNight.isNight(),
          trafficActive: this.traffic.getActiveCount ? this.traffic.getActiveCount() : 0,
          pedestriansActive: this.pedestrians.getActiveCount ? this.pedestrians.getActiveCount() : 0
        },
        audio: {
          initialized: this.audio._initialized,
          muted: this.audio.isMuted(),
          volume: this.audio.getVolume()
        },
        player: {
          x: Number(this.physics.position.x.toFixed(2)),
          y: Number(this.physics.position.y.toFixed(2)),
          z: Number(this.physics.position.z.toFixed(2)),
          speed: Number(this.physics.speed.toFixed(2)),
          kmh: this.physics.getKmh(),
          heading: Number(this.physics.heading.toFixed(3)),
          steerAngle: Number(this.physics.steerAngle.toFixed(3)),
          gear: this.physics.getGear(),
          rpm: this.physics.getRpm()
        },
        touchControls: {
          visible: this.touchControls.container.style.display !== 'none',
          prefs: this.touchControls.prefs
        },
        vehicle: {
          id: this.currentVehicleData.id,
          name: this.currentVehicleData.name,
          fuel: Number(this.currentVehicleData.fuel.toFixed(1)),
          maxFuel: this.currentVehicleData.maxFuel,
          color: this.currentVehicleData.color,
          rimStyle: this.currentVehicleData.rimStyle,
          spoilerType: this.currentVehicleData.spoilerType
        },
        economy: {
          money: this.economy.getMoney(),
          ownedVehiclesCount: this.saveData.ownedVehicles.length
        },
        performance: metrics
      };
      return JSON.stringify(state);
    };

    window.advanceTime = (ms) => {
      const dt = ms / 1000;
      this.step(dt);
      this.renderer.render(this.scene, this.cameraController.camera);
    };
  }

  onKeyDown(e) {
    if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } else if (e.key === 'm' || e.key === 'M') {
      this.toggleAudio();
    } else if (e.key === 'h' || e.key === 'H') {
      if (this.audio) this.audio.playHonk();
    }
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.cameraController.onResize(width / height);
    this.renderer.setSize(width, height);
    if (this.touchControls) {
      this.touchControls.updateVisibility();
    }
  }

  toggleCameraView() {
    const newMode = this.cameraController.toggleViewMode();
    const btn = document.querySelector('#btn-camera span');
    if (btn) {
      btn.textContent = newMode === 'chase' ? 'ISO' : 'CAM';
    }
  }

  handleInteractionKey() {
    const pos = this.physics.position;

    // 1. Garage Zone (0, -30)
    const dGarage = Math.hypot(pos.x - 0, pos.z - (-30));
    if (dGarage < 8.5) {
      if (this.audio) this.audio.playUIClick();
      this.modals.openGarage();
      return;
    }

    // 2. Gas Station Zone (45, 0)
    if (this.fuelSystem.isAtGasStation(pos)) {
      if (this.audio) this.audio.playUIClick();
      this.modals.openGasStation();
      return;
    }

    // 3. Dealership Zone (0, 30)
    const dDealer = Math.hypot(pos.x - 0, pos.z - 30);
    if (dDealer < 8.5) {
      if (this.audio) this.audio.playUIClick();
      this.modals.openDealership();
      return;
    }

    // 4. Car Meet & Automotive Community Zone (75, 75)
    const dMeet = Math.hypot(pos.x - 75, pos.z - 75);
    if (dMeet < 14.0) {
      if (this.audio) this.audio.playUIClick();
      this.modals.openCarMeet();
      return;
    }
  }

  switchVehicle(vehicleId) {
    const target = this.saveData.ownedVehicles.find(v => v.id === vehicleId);
    if (!target) return;

    this.saveData.currentVehicleId = vehicleId;
    this.currentVehicleData = target;

    this.scene.remove(this.car.mesh);
    this.car = new Car(this.currentVehicleData);
    this.scene.add(this.car.mesh);
    this.car.update(this.physics, 0);

    if (this.dayNight && this.dayNight.isNight()) {
      this.car.setHeadlights(true);
    }

    this.saveProgress();
  }

  applyCustomizationToActiveCar() {
    this.car.applyCustomization(this.currentVehicleData);
    this.saveProgress();
  }

  saveProgress() {
    SaveSystem.save(this.saveData);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.animate);
  }

  step(dt) {
    const inputState = this.modals.activeModal
      ? { forward: false, backward: false, left: false, right: false, handbrake: true }
      : this.input.keys;

    // 1. Vehicle Physics with analog steer support
    this.physics.update(dt, inputState, this.collision, this.input);

    // 2. Day / Night Cycle Progression & Lighting
    this.dayNight.update(dt);

    // 3. AI Traffic Simulation (distance culling, obstacle avoidance)
    this.traffic.update(dt, this.physics.position);

    // 4. Pedestrian NPC Simulation (sidewalk navigation, idle animations)
    this.pedestrians.update(dt, this.physics.position);

    // 5. Fuel System
    this.fuelSystem.update(dt, this.currentVehicleData, this.physics);

    // 6. Visual Entity Update
    this.car.update(this.physics, dt);

    // 7. Isometric / Chase Camera Tracking
    this.cameraController.update(dt, this.physics.position, this.physics.speed, this.physics.heading);

    // 8. Sun Light Anchor Follows Player
    this.sunLight.position.set(this.physics.position.x + 50, 80, this.physics.position.z + 40);
    this.sunLight.target.position.copy(this.physics.position);
    this.sunLight.target.updateMatrixWorld();

    // 9. Procedural Audio Engine Update
    if (this.audio) {
      this.audio.updateEngineSound(
        Math.abs(this.physics.speed),
        this.physics.maxForwardSpeed,
        this.physics.getRpm()
      );
      if (inputState.handbrake && Math.abs(this.physics.speed) > 6.0) {
        this.audio.playBrakeSqueal(Math.min(1.0, Math.abs(this.physics.speed) / 20));
      }
    }

    // 10. Interactive Zones Proximity Check
    const pos = this.physics.position;
    if (Math.hypot(pos.x - 0, pos.z - (-30)) < 8.5) {
      this.modals.showPrompt('Enter Garage [E]');
    } else if (this.fuelSystem.isAtGasStation(pos)) {
      this.modals.showPrompt('Refuel at Gas Station [E]');
    } else if (Math.hypot(pos.x - 0, pos.z - 30) < 8.5) {
      this.modals.showPrompt('Enter Dealership [E]');
    } else if (Math.hypot(pos.x - 75, pos.z - 75) < 14.0) {
      this.modals.showPrompt('Join Car Meet [E]');
    } else {
      this.modals.hidePrompt();
    }

    // 11. Update HUD
    this.hud.update(
      this.physics,
      inputState,
      this.currentVehicleData,
      this.economy.getMoney(),
      this.dayNight,
      this.audio
    );

    // 12. Auto-Save Timer
    const now = performance.now();
    if (now - this.lastAutoSave >= 15000) {
      this.saveProgress();
      this.lastAutoSave = now;
    }
  }

  animate(currentTime) {
    if (!this.isRunning) return;

    this.perfMonitor.begin();

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.step(dt);
    this.renderer.render(this.scene, this.cameraController.camera);

    this.perfMonitor.end();

    this.graphicsQuality.update(this.perfMonitor.fps);

    requestAnimationFrame(this.animate);
  }

  dispose() {
    this.isRunning = false;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.input.dispose();
    this.hud.dispose();
    this.modals.dispose();
    this.touchControls.dispose();
    this.perfMonitor.dispose();
    if (this.audio) this.audio.dispose();
    if (this.traffic) this.traffic.dispose();
    if (this.pedestrians) this.pedestrians.dispose();
    if (this.worldPolish) this.worldPolish.dispose();
    this.renderer.dispose();
  }
}
