export class GraphicsQualityManager {
  constructor(engine) {
    this.engine = engine;
    this.currentPreset = 'MEDIUM'; // Balanced laptop default
    this.isAutoAdjust = true;

    // Performance tracking for auto-downscale
    this.consecutiveLowFpsCount = 0;
    this.consecutiveHighFpsCount = 0;
    this.lastEvaluationTime = performance.now();
    this.evaluationIntervalMs = 4000; // Evaluate every 4 seconds to avoid flip-flopping

    // Preset configurations
    this.presets = {
      LOW: {
        name: 'LOW',
        pixelRatio: 1.0,
        enableShadows: false,
        shadowMapSize: 512,
        maxLights: 1,
        detailsDistance: 80,
        renderScale: 0.85,
        traffic: 3,
        pedestrians: 4
      },
      MEDIUM: {
        name: 'MEDIUM',
        pixelRatio: 1.0,
        enableShadows: true,
        shadowMapSize: 1024,
        maxLights: 2,
        detailsDistance: 140,
        renderScale: 1.0,
        traffic: 6,
        pedestrians: 10
      },
      HIGH: {
        name: 'HIGH',
        pixelRatio: Math.min(window.devicePixelRatio || 1.0, 1.25),
        enableShadows: true,
        shadowMapSize: 2048,
        maxLights: 3,
        detailsDistance: 220,
        renderScale: 1.0,
        traffic: 10,
        pedestrians: 20
      }
    };

    // Load saved preferences if available
    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('uml_graphics_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (this.presets[parsed.preset]) {
          this.currentPreset = parsed.preset;
        }
        if (typeof parsed.autoAdjust === 'boolean') {
          this.isAutoAdjust = parsed.autoAdjust;
        }
      }
    } catch (e) {
      console.warn('Failed to load graphics preferences:', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('uml_graphics_settings', JSON.stringify({
        preset: this.currentPreset,
        autoAdjust: this.isAutoAdjust
      }));
    } catch (e) {
      console.warn('Failed to save graphics preferences:', e);
    }
  }

  applyPreset(presetKey) {
    const config = this.presets[presetKey];
    if (!config) return;

    this.currentPreset = presetKey;
    const renderer = this.engine.renderer;
    const sunLight = this.engine.sunLight;

    // 1. Pixel Ratio & Resolution
    const targetPixelRatio = Math.min(config.pixelRatio, 1.5);
    renderer.setPixelRatio(targetPixelRatio);
    renderer.setSize(window.innerWidth * config.renderScale, window.innerHeight * config.renderScale, false);

    // 2. Shadows
    renderer.shadowMap.enabled = config.enableShadows;
    if (sunLight) {
      sunLight.castShadow = config.enableShadows;
      if (config.enableShadows) {
        sunLight.shadow.mapSize.width = config.shadowMapSize;
        sunLight.shadow.mapSize.height = config.shadowMapSize;
        if (sunLight.shadow.map) {
          sunLight.shadow.map.dispose();
          sunLight.shadow.map = null;
        }
      }
    }

    // 3. Environmental Detail toggles & Entity Densities
    if (this.engine.environment) {
      this.engine.environment.setDetailLevel(presetKey);
    }
    if (this.engine.traffic && config.traffic !== undefined) {
      this.engine.traffic.setDensity(config.traffic);
    }
    if (this.engine.pedestrians && config.pedestrians !== undefined) {
      this.engine.pedestrians.setDensity(config.pedestrians);
    }

    // 4. Update Diagnostics Label
    if (this.engine.perfMonitor) {
      this.engine.perfMonitor.setQualityLabel(`${presetKey}${this.isAutoAdjust ? ' (AUTO)' : ''}`);
    }

    this.saveSettings();
  }

  setManualPreset(presetKey) {
    this.isAutoAdjust = false;
    this.applyPreset(presetKey);
  }

  setAutoAdjust(enabled) {
    this.isAutoAdjust = enabled;
    if (this.engine.perfMonitor) {
      this.engine.perfMonitor.setQualityLabel(`${this.currentPreset}${this.isAutoAdjust ? ' (AUTO)' : ''}`);
    }
    this.saveSettings();
  }

  update(currentFps) {
    if (!this.isAutoAdjust) return;

    const now = performance.now();
    if (now - this.lastEvaluationTime < this.evaluationIntervalMs) return;
    this.lastEvaluationTime = now;

    // Automatic degradation when laptop is struggling (< 32 FPS)
    if (currentFps < 32) {
      this.consecutiveLowFpsCount++;
      this.consecutiveHighFpsCount = 0;

      if (this.consecutiveLowFpsCount >= 2) {
        // Step down quality
        if (this.currentPreset === 'HIGH') {
          console.log('[GraphicsManager] Downscaling to MEDIUM preset due to low FPS (' + currentFps + ')');
          this.applyPreset('MEDIUM');
        } else if (this.currentPreset === 'MEDIUM') {
          console.log('[GraphicsManager] Downscaling to LOW preset due to low FPS (' + currentFps + ')');
          this.applyPreset('LOW');
        }
        this.consecutiveLowFpsCount = 0;
      }
    } else if (currentFps >= 55) {
      this.consecutiveHighFpsCount++;
      this.consecutiveLowFpsCount = 0;

      // Only upgrade if consistently high for over 12 seconds
      if (this.consecutiveHighFpsCount >= 3) {
        if (this.currentPreset === 'LOW') {
          console.log('[GraphicsManager] Upscaling to MEDIUM preset due to stable FPS (' + currentFps + ')');
          this.applyPreset('MEDIUM');
        }
        this.consecutiveHighFpsCount = 0;
      }
    } else {
      this.consecutiveLowFpsCount = 0;
      this.consecutiveHighFpsCount = 0;
    }
  }
}
