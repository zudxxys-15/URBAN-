import * as THREE from 'three';

/**
 * DayNightCycle — time-of-day system with gradual lighting transitions.
 *
 * Game time: 1 real second = 1 game minute (full day = 24 real minutes).
 * Smoothly interpolates background, fog, sun and hemisphere light across
 * Morning → Afternoon → Evening → Night.
 */

// ---------- Palette definitions ----------

const PALETTES = {
  morning: {
    background: new THREE.Color(0x87ceeb),
    sunColor: new THREE.Color(0xfff5e6),
    sunIntensity: 1.2,
    hemiSky: new THREE.Color(0x87ceeb),
    hemiGround: new THREE.Color(0x3a5f3a),
    hemiIntensity: 0.8,
    fogDensity: 0.004,
  },
  afternoon: {
    background: new THREE.Color(0x6bb3e0),
    sunColor: new THREE.Color(0xfff7ed),
    sunIntensity: 1.5,
    hemiSky: new THREE.Color(0x93c5fd),
    hemiGround: new THREE.Color(0x1e293b),
    hemiIntensity: 0.75,
    fogDensity: 0.005,
  },
  eveningStart: {
    background: new THREE.Color(0xff8c42),
    sunColor: new THREE.Color(0xff6b35),
    sunIntensity: 0.8,
    hemiSky: new THREE.Color(0xffa07a),
    hemiGround: new THREE.Color(0x1a1a2e),
    hemiIntensity: 0.5,
    fogDensity: 0.006,
  },
  eveningEnd: {
    background: new THREE.Color(0x2d1b4e),
    sunColor: new THREE.Color(0xff6b35),
    sunIntensity: 0.2,
    hemiSky: new THREE.Color(0xffa07a),
    hemiGround: new THREE.Color(0x1a1a2e),
    hemiIntensity: 0.5,
    fogDensity: 0.006,
  },
  night: {
    background: new THREE.Color(0x0f172a),
    sunColor: new THREE.Color(0x334488),
    sunIntensity: 0.1,
    hemiSky: new THREE.Color(0x111133),
    hemiGround: new THREE.Color(0x0a0a15),
    hemiIntensity: 0.25,
    fogDensity: 0.008,
  },
};

// Reusable scratch colors to avoid allocations
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

function lerpPalette(out, a, b, t) {
  out.background.copy(a.background).lerp(b.background, t);
  out.sunColor.copy(a.sunColor).lerp(b.sunColor, t);
  out.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t);
  out.fogDensity = THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, t);
}

// Scratch palette for interpolation results
function makeScratch() {
  return {
    background: new THREE.Color(),
    sunColor: new THREE.Color(),
    sunIntensity: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 0,
    fogDensity: 0,
  };
}

export class DayNightCycle {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.DirectionalLight} sunLight
   * @param {THREE.HemisphereLight} hemiLight
   */
  constructor(scene, sunLight, hemiLight) {
    this.scene = scene;
    this.sunLight = sunLight;

    // Accept hemiLight as parameter, or find the first HemisphereLight in scene
    if (hemiLight) {
      this.hemiLight = hemiLight;
    } else {
      this.hemiLight = null;
      scene.traverse((child) => {
        if (!this.hemiLight && child.isHemisphereLight) {
          this.hemiLight = child;
        }
      });
    }

    // Time state
    this.hours = 10.0; // start at 10 AM
    this.timeScale = 1.0; // 1.0 = normal speed

    // Period tracking for event callbacks
    this._prevPeriod = this.getPeriod();

    // Callbacks
    this.onNightStart = null;
    this.onDayStart = null;

    // Scratch object for interpolation
    this._scratch = makeScratch();

    // Apply initial lighting
    this._applyLighting();
  }

  // ---- Public API ----

  /**
   * Advance game time and update all lighting.
   * @param {number} dt — real elapsed seconds
   */
  update(dt) {
    // 1 real second = 1 game minute = 1/60 of an hour
    this.hours += (dt * this.timeScale) / 60;

    // Wrap around midnight
    if (this.hours >= 24.0) {
      this.hours -= 24.0;
    }

    this._applyLighting();
    this._checkTransitions();
  }

  /**
   * @returns {string} Formatted time such as "10:30 AM" or "22:15"
   */
  getTimeString() {
    const h = Math.floor(this.hours) % 24;
    const m = Math.floor((this.hours - Math.floor(this.hours)) * 60);
    const mm = m.toString().padStart(2, '0');
    if (h === 0) return `12:${mm} AM`;
    if (h < 12) return `${h}:${mm} AM`;
    if (h === 12) return `12:${mm} PM`;
    return `${h - 12}:${mm} PM`;
  }

  /**
   * @returns {'morning'|'afternoon'|'evening'|'night'}
   */
  getPeriod() {
    const h = this.hours;
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  /**
   * @returns {number} Current hour as float (0.0–24.0)
   */
  getHours() {
    return this.hours;
  }

  /**
   * @returns {boolean} true if 20:00–6:00
   */
  isNight() {
    return this.hours >= 20 || this.hours < 6;
  }

  /**
   * Change time progression speed.
   * @param {number} scale — 1.0 is normal, 2.0 is double speed, etc.
   */
  setTimeScale(scale) {
    this.timeScale = scale;
  }

  // ---- Internals ----

  /**
   * Determine interpolated palette for current time and apply to scene objects.
   */
  _applyLighting() {
    const h = this.hours;
    const p = this._scratch;

    if (h >= 6 && h < 12) {
      // Morning — blend from night→morning at 6, fully morning by ~7, then morning→afternoon at 12
      if (h < 7) {
        // sunrise transition: night → morning over 6:00–7:00
        const t = h - 6; // 0..1
        lerpPalette(p, PALETTES.night, PALETTES.morning, t);
      } else if (h > 11) {
        // approach afternoon: morning → afternoon over 11:00–12:00
        const t = h - 11; // 0..1
        lerpPalette(p, PALETTES.morning, PALETTES.afternoon, t);
      } else {
        // solid morning
        lerpPalette(p, PALETTES.morning, PALETTES.morning, 0);
      }
    } else if (h >= 12 && h < 17) {
      if (h < 13) {
        // finishing morning→afternoon blend 12:00–13:00
        const t = h - 12; // 0..1
        lerpPalette(p, PALETTES.morning, PALETTES.afternoon, t);
      } else if (h > 16) {
        // approach evening: afternoon → evening over 16:00–17:00
        const t = h - 16; // 0..1
        lerpPalette(p, PALETTES.afternoon, PALETTES.eveningStart, t);
      } else {
        lerpPalette(p, PALETTES.afternoon, PALETTES.afternoon, 0);
      }
    } else if (h >= 17 && h < 20) {
      // Evening — blend eveningStart→eveningEnd across 17:00–20:00
      // and at 19:00–20:00 also start transitioning toward night
      const eveningT = (h - 17) / 3; // 0..1 across the whole evening
      if (h >= 19) {
        // 19:00–20:00: eveningEnd → night
        const nightT = h - 19; // 0..1
        const eveningPal = makeScratch();
        lerpPalette(eveningPal, PALETTES.eveningStart, PALETTES.eveningEnd, eveningT);
        lerpPalette(p, eveningPal, PALETTES.night, nightT);
      } else {
        lerpPalette(p, PALETTES.eveningStart, PALETTES.eveningEnd, eveningT);
      }
    } else {
      // Night (20:00–6:00)
      if (h >= 20 && h < 21) {
        // finishing evening → night blend
        const t = h - 20; // 0..1
        lerpPalette(p, PALETTES.eveningEnd, PALETTES.night, t);
      } else if (h >= 5 && h < 6) {
        // pre-dawn: night → morning over 5:00–6:00
        const t = h - 5; // 0..1
        lerpPalette(p, PALETTES.night, PALETTES.morning, t);
      } else {
        lerpPalette(p, PALETTES.night, PALETTES.night, 0);
      }
    }

    // Apply to scene
    if (this.scene.background) {
      this.scene.background.copy(p.background);
    } else {
      this.scene.background = p.background.clone();
    }

    if (this.scene.fog) {
      this.scene.fog.color.copy(p.background);
      // Support both FogExp2 (density) and Fog (near/far derived from density)
      if (this.scene.fog.density !== undefined) {
        this.scene.fog.density = p.fogDensity;
      }
    }

    // Sun (directional light)
    if (this.sunLight) {
      this.sunLight.color.copy(p.sunColor);
      this.sunLight.intensity = p.sunIntensity;
    }

    // Hemisphere light
    if (this.hemiLight) {
      this.hemiLight.color.copy(p.hemiSky);
      this.hemiLight.groundColor.copy(p.hemiGround);
      this.hemiLight.intensity = p.hemiIntensity;
    }
  }

  /**
   * Fire onNightStart / onDayStart when the period changes.
   */
  _checkTransitions() {
    const current = this.getPeriod();
    if (current !== this._prevPeriod) {
      if (current === 'night' && this.onNightStart) {
        this.onNightStart();
      }
      if (current === 'morning' && this.onDayStart) {
        this.onDayStart();
      }
      this._prevPeriod = current;
    }
  }
}
