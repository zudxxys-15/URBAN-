import * as THREE from 'three';
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
import { AutomotiveHUD } from './ui/AutomotiveHUD.js';
import { ModalsManager } from './ui/ModalsManager.js';

export class GameEngine {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.isRunning = false;
    this.lastTime = performance.now();

    // 1. Core Persistence & Economy
    this.saveData = SaveSystem.load();
    this.economy = new EconomySystem();
    this.fuelSystem = new FuelSystem(this.economy);

    // Current active vehicle metadata
    this.currentVehicleData = this.saveData.ownedVehicles.find(
      v => v.id === this.saveData.currentVehicleId
    ) || this.saveData.ownedVehicles[0];

    // 2. High-Performance WebGL Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1.0); // Baseline 1.0 for laptop efficiency
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.canvas = this.renderer.domElement;
    this.container.appendChild(this.canvas);

    // 3. Performance Monitor & Diagnostics (F3 Panel)
    this.perfMonitor = new PerformanceMonitor(this.renderer);

    // 4. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.005);

    // 5. Lighting Setup (optimized)
    this.setupLighting();

    // 6. Subsystems
    this.input = new InputManager();
    this.collision = new CollisionSystem();
    this.physics = new VehiclePhysics();
    this.cameraController = new IsometricCamera(window.innerWidth / window.innerHeight);
    this.hud = new AutomotiveHUD(this);
    this.modals = new ModalsManager(this);
    window.__UML_MODALS__ = this.modals;

    // 7. World Environment & Car Entity
    this.environment = new UrbanEnvironment(this.scene, this.collision);
    this.car = new Car(this.currentVehicleData);
    this.scene.add(this.car.mesh);

    // Spawn vehicle
    this.physics.position.set(0, 0, 0);
    this.physics.heading = 0;
    this.car.update(this.physics, 0);
    this.cameraController.init(this.physics.position);

    // 8. Graphics Quality Manager (Low/Med/High presets & dynamic auto-adjust)
    this.graphicsQuality = new GraphicsQualityManager(this);
    this.graphicsQuality.applyPreset(this.graphicsQuality.currentPreset);

    // 9. Event Listeners
    this.onResize = this.onResize.bind(this);
    this.animate = this.animate.bind(this);
    window.addEventListener('resize', this.onResize);

    this.onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDown);

    // 10. Auto-Save periodically every 15 seconds
    this.lastAutoSave = performance.now();

    // 11. Testing loop hooks
    this.setupTestingHooks();
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.75);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.5);
    this.sunLight.position.set(50, 80, 40);
    this.sunLight.castShadow = true;
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

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.3);
    fillLight.position.set(-50, 40, -40);
    this.scene.add(fillLight);
  }

  setupTestingHooks() {
    window.render_game_to_text = () => {
      const metrics = this.perfMonitor.getMetrics();
      const state = {
        mode: this.modals.activeModal ? `modal_${this.modals.activeModal}` : 'driving',
        player: {
          x: Number(this.physics.position.x.toFixed(2)),
          y: Number(this.physics.position.y.toFixed(2)),
          z: Number(this.physics.position.z.toFixed(2)),
          speed: Number(this.physics.speed.toFixed(2)),
          kmh: this.physics.getKmh(),
          heading: Number(this.physics.heading.toFixed(3)),
          gear: this.physics.getGear(),
          rpm: this.physics.getRpm()
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
    }
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.cameraController.onResize(width / height);
    this.renderer.setSize(width, height);
  }

  handleInteractionKey() {
    const pos = this.physics.position;

    // 1. Check Garage Zone (0, -30)
    const dGarage = Math.hypot(pos.x - 0, pos.z - (-30));
    if (dGarage < 8.0) {
      this.modals.openGarage();
      return;
    }

    // 2. Check Gas Station Zone (45, 0)
    if (this.fuelSystem.isAtGasStation(pos)) {
      this.modals.openGasStation();
      return;
    }

    // 3. Check Dealership Zone (0, 30)
    const dDealer = Math.hypot(pos.x - 0, pos.z - 30);
    if (dDealer < 8.0) {
      this.modals.openDealership();
      return;
    }
  }

  switchVehicle(vehicleId) {
    const target = this.saveData.ownedVehicles.find(v => v.id === vehicleId);
    if (!target) return;

    this.saveData.currentVehicleId = vehicleId;
    this.currentVehicleData = target;

    // Rebuild/re-apply active vehicle visual and specs
    this.scene.remove(this.car.mesh);
    this.car = new Car(this.currentVehicleData);
    this.scene.add(this.car.mesh);
    this.car.update(this.physics, 0);

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
    // If a modal is currently open, freeze driving inputs
    const inputState = this.modals.activeModal ? { forward: false, backward: false, left: false, right: false, handbrake: true } : this.input.keys;

    // 1. Vehicle Physics & Collision
    this.physics.update(dt, inputState, this.collision);

    // 2. Fuel Consumption
    this.fuelSystem.update(dt, this.currentVehicleData, this.physics);

    // 3. Car Visual Entity Update
    this.car.update(this.physics, dt);

    // 4. Isometric Camera Tracking
    this.cameraController.update(dt, this.physics.position, this.physics.speed, this.physics.heading);

    // 5. Directional Light Anchor
    this.sunLight.position.set(this.physics.position.x + 50, 80, this.physics.position.z + 40);
    this.sunLight.target.position.copy(this.physics.position);
    this.sunLight.target.updateMatrixWorld();

    // 6. Interactive Zones Proximity Check
    const pos = this.physics.position;
    if (Math.hypot(pos.x - 0, pos.z - (-30)) < 8.0) {
      this.modals.showPrompt('Enter Garage [E]');
    } else if (this.fuelSystem.isAtGasStation(pos)) {
      this.modals.showPrompt('Refuel at Gas Station [E]');
    } else if (Math.hypot(pos.x - 0, pos.z - 30) < 8.0) {
      this.modals.showPrompt('Enter Dealership [E]');
    } else {
      this.modals.hidePrompt();
    }

    // 7. Update HUD
    this.hud.update(this.physics, inputState, this.currentVehicleData, this.economy.getMoney());

    // 8. Auto-Save Timer
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

    // Check graphics quality auto scaling
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
    this.perfMonitor.dispose();
    this.renderer.dispose();
  }
}
