import * as THREE from 'three';
import { TrafficVehicle } from '../entities/TrafficVehicle.js';

// ─── Density presets ───
const DENSITY = { LOW: 3, MEDIUM: 6, HIGH: 10 };

// ─── Waypoint lanes ───
// Each lane is an object: { id, waypoints:[], axis:'x'|'z', sign:+1|-1 }
// sign tells us which direction the vehicle travels along its axis.
function buildLanes() {
  const LANE_START = -120;
  const LANE_END = 120;
  const STEP = 30; // waypoint spacing

  // Helper: generate points from start→end with given step
  const range = (from, to, step) => {
    const pts = [];
    if (from < to) {
      for (let v = from; v <= to; v += step) pts.push(v);
      if (pts[pts.length - 1] < to) pts.push(to);
    } else {
      for (let v = from; v >= to; v -= step) pts.push(v);
      if (pts[pts.length - 1] > to) pts.push(to);
    }
    return pts;
  };

  return [
    {
      id: 'east',
      axis: 'x',
      sign: 1,
      waypoints: range(LANE_START, LANE_END, STEP).map((x) => new THREE.Vector3(x, 0, -3)),
    },
    {
      id: 'west',
      axis: 'x',
      sign: -1,
      waypoints: range(LANE_END, LANE_START, STEP).map((x) => new THREE.Vector3(x, 0, 3)),
    },
    {
      id: 'north',
      axis: 'z',
      sign: 1,
      waypoints: range(LANE_START, LANE_END, STEP).map((z) => new THREE.Vector3(3, 0, z)),
    },
    {
      id: 'south',
      axis: 'z',
      sign: -1,
      waypoints: range(LANE_END, LANE_START, STEP).map((z) => new THREE.Vector3(-3, 0, z)),
    },
  ];
}

// ─── Temp vectors (avoid GC in hot loop) ───
const _dir = new THREE.Vector3();
const _diff = new THREE.Vector3();

export class TrafficSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/CollisionSystem.js').CollisionSystem} collisionSystem
   * @param {object} [opts]
   * @param {number} [opts.maxPool=10] — maximum number of pooled vehicles
   */
  constructor(scene, collisionSystem, opts = {}) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;

    this.lanes = buildLanes();
    this.maxPool = opts.maxPool ?? 10;

    /** @type {{ vehicle: TrafficVehicle, laneIdx: number, wpIdx: number, speed: number, active: boolean, speedVar: number }[]} */
    this.pool = [];

    this._headlightsOn = false;

    // Pre-create pooled vehicles
    for (let i = 0; i < this.maxPool; i++) {
      const vehicle = new TrafficVehicle();
      this.scene.add(vehicle.mesh);

      this.pool.push({
        vehicle,
        laneIdx: 0,
        wpIdx: 0,
        speed: 0,
        active: false,
        speedVar: 1, // per-vehicle ±20% multiplier
      });
    }

    // Activate default density
    this.setDensity(DENSITY.MEDIUM);
  }

  // ─── Density ───

  /**
   * Activate `count` vehicles from the pool, distributing evenly across lanes.
   * @param {number} count
   */
  setDensity(count) {
    count = Math.min(count, this.maxPool);

    // Deactivate all first
    for (const entry of this.pool) {
      entry.active = false;
      entry.vehicle.mesh.visible = false;
    }

    // Activate and assign lanes
    for (let i = 0; i < count; i++) {
      const entry = this.pool[i];
      entry.active = true;
      entry.vehicle.mesh.visible = true;
      entry.laneIdx = i % this.lanes.length;
      entry.speed = 8 + Math.random() * 7; // 8–15 u/s
      entry.speedVar = 0.8 + Math.random() * 0.4; // ±20%

      // Spread vehicles along the lane so they don't all start in the same spot
      const lane = this.lanes[entry.laneIdx];
      const startWp = Math.floor(Math.random() * lane.waypoints.length);
      entry.wpIdx = startWp;
      entry.vehicle.mesh.position.copy(lane.waypoints[startWp]);

      // Face along lane direction
      this._orientToLane(entry);

      // Headlights
      entry.vehicle.setHeadlightsOn(this._headlightsOn);
    }
  }

  // ─── Headlights ───

  /** Toggle headlights on all active vehicles. */
  setHeadlights(on) {
    this._headlightsOn = on;
    for (const entry of this.pool) {
      if (entry.active) {
        entry.vehicle.setHeadlightsOn(on);
      }
    }
  }

  // ─── Update ───

  /**
   * @param {number} dt — delta time (seconds)
   * @param {THREE.Vector3} playerPosition
   */
  update(dt, playerPosition) {
    for (let i = 0; i < this.pool.length; i++) {
      const entry = this.pool[i];
      if (!entry.active) continue;

      const pos = entry.vehicle.mesh.position;

      // Distance-based LOD: skip physics if too far from player
      if (playerPosition) {
        const dx = pos.x - playerPosition.x;
        const dz = pos.z - playerPosition.z;
        if (dx * dx + dz * dz > 150 * 150) continue;
      }

      const lane = this.lanes[entry.laneIdx];
      const wps = lane.waypoints;

      // Target waypoint
      let targetIdx = (entry.wpIdx + 1) % wps.length;
      const target = wps[targetIdx];

      // Direction to target
      _dir.subVectors(target, pos);
      _dir.y = 0;
      const distToTarget = _dir.length();

      if (distToTarget < 1.0) {
        // Advance waypoint
        entry.wpIdx = targetIdx;
        targetIdx = (entry.wpIdx + 1) % wps.length;

        // If looped back to start → respawn at start
        if (targetIdx === 0) {
          entry.wpIdx = 0;
          pos.copy(wps[0]);
          this._orientToLane(entry);
          continue;
        }
      }

      // ---- Speed modulation ----
      let currentSpeed = entry.speed * entry.speedVar;

      // Following distance: slow down if another vehicle on same lane is ahead and < 12 units
      currentSpeed = this._applyFollowing(entry, i, currentSpeed);

      // Player avoidance: slow/stop if < 8 units from player
      if (playerPosition) {
        _diff.subVectors(pos, playerPosition);
        _diff.y = 0;
        const distPlayer = _diff.length();
        if (distPlayer < 8) {
          currentSpeed *= Math.max(0, (distPlayer - 2) / 6); // ramp down to 0
        }
      }

      // Move toward target
      _dir.subVectors(wps[targetIdx], pos);
      _dir.y = 0;
      _dir.normalize();

      pos.x += _dir.x * currentSpeed * dt;
      pos.z += _dir.z * currentSpeed * dt;

      // Rotate to face travel direction
      entry.vehicle.mesh.rotation.y = Math.atan2(_dir.x, _dir.z);
    }
  }

  /**
   * Check if any vehicle in the same lane is ahead and within following distance.
   * If so, reduce speed proportionally.
   * @private
   */
  _applyFollowing(entry, poolIdx, speed) {
    const pos = entry.vehicle.mesh.position;
    const lane = this.lanes[entry.laneIdx];

    for (let j = 0; j < this.pool.length; j++) {
      if (j === poolIdx) continue;
      const other = this.pool[j];
      if (!other.active || other.laneIdx !== entry.laneIdx) continue;

      const oPos = other.vehicle.mesh.position;
      _diff.subVectors(oPos, pos);
      _diff.y = 0;
      const dist = _diff.length();

      if (dist < 12) {
        // Check "ahead" using lane direction sign
        const ahead =
          lane.axis === 'x'
            ? (oPos.x - pos.x) * lane.sign > 0
            : (oPos.z - pos.z) * lane.sign > 0;

        if (ahead) {
          // The closer, the slower (linear ramp: 0 at dist=2, full speed at dist=12)
          const factor = Math.max(0, (dist - 2) / 10);
          speed = Math.min(speed, speed * factor);
        }
      }
    }
    return speed;
  }

  /** @private Orient the vehicle mesh to face along its lane direction. */
  _orientToLane(entry) {
    const lane = this.lanes[entry.laneIdx];
    const wps = lane.waypoints;
    const nextIdx = (entry.wpIdx + 1) % wps.length;
    if (nextIdx === entry.wpIdx) return;
    _dir.subVectors(wps[nextIdx], wps[entry.wpIdx]);
    entry.vehicle.mesh.rotation.y = Math.atan2(_dir.x, _dir.z);
  }

  getActiveCount() {
    return this.pool.filter(e => e.active).length;
  }

  // ─── Dispose ───

  dispose() {
    for (const entry of this.pool) {
      entry.vehicle.dispose();
      entry.active = false;
    }
    this.pool.length = 0;
  }
}

// Re-export density presets for convenience
TrafficSystem.DENSITY = DENSITY;
