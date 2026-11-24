import * as THREE from 'three';
import { Pedestrian } from '../entities/Pedestrian.js';

// Density presets
const DENSITY = { LOW: 4, MEDIUM: 10, HIGH: 20 };

// ── Sidewalk walking paths ──────────────────────────────────────────
// Each path is { start: Vector3, end: Vector3 }
// NPCs walk back-and-forth between start and end.

function definePaths() {
  const paths = [];

  // East-West sidewalks (along the main E-W road, north/south edges)
  paths.push({ start: new THREE.Vector3(-120, 0, -9), end: new THREE.Vector3(120, 0, -9) });
  paths.push({ start: new THREE.Vector3(120, 0, 9), end: new THREE.Vector3(-120, 0, 9) });

  // North-South sidewalks (along the main N-S road, east/west edges)
  paths.push({ start: new THREE.Vector3(-9, 0, -120), end: new THREE.Vector3(-9, 0, 120) });
  paths.push({ start: new THREE.Vector3(9, 0, 120), end: new THREE.Vector3(9, 0, -120) });

  // Near-building patrol segments in each quadrant
  const quadrants = [
    { cx: -65, cz: -65 },
    { cx: 65, cz: -65 },
    { cx: -65, cz: 65 },
    { cx: 65, cz: 65 },
  ];
  for (const q of quadrants) {
    // Two short patrol paths near each quadrant center
    paths.push({
      start: new THREE.Vector3(q.cx - 15, 0, q.cz),
      end: new THREE.Vector3(q.cx + 15, 0, q.cz),
    });
    paths.push({
      start: new THREE.Vector3(q.cx, 0, q.cz - 12),
      end: new THREE.Vector3(q.cx, 0, q.cz + 12),
    });
  }

  return paths;
}

// Standing positions near interactive zones
const STANDING_POSITIONS = [
  { x: 2, z: -30, ry: 0 },       // garage
  { x: -2, z: -28, ry: Math.PI }, // garage
  { x: 45, z: 2, ry: -Math.PI / 2 },  // gas station
  { x: 43, z: -2, ry: Math.PI / 2 },   // gas station
  { x: 2, z: 30, ry: Math.PI },   // dealership
  { x: -2, z: 32, ry: 0 },       // dealership
];

// ── NPC wrapper ─────────────────────────────────────────────────────
class NPCInstance {
  constructor(pedestrian) {
    this.ped = pedestrian;
    this.active = false;
    this.state = 'walking'; // walking | idle | standing
    this.speed = 1.5 + Math.random() * 1.5; // 1.5-3.0 u/s
    this.path = null;        // assigned path { start, end }
    this.progress = 0;       // 0-1 along path
    this.direction = 1;      // +1 or -1
    this.idleTimer = 0;
    this.idleDuration = 0;
  }

  reset(path, state) {
    this.path = path;
    this.state = state;
    this.progress = Math.random();
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.idleTimer = 0;
    this.idleDuration = 0;
    this.speed = 1.5 + Math.random() * 1.5;
    this.ped.setWalking(state === 'walking');
    this._updateMeshPosition();
  }

  _updateMeshPosition() {
    if (!this.path) return;
    const { start, end } = this.path;
    const t = this.progress;
    this.ped.mesh.position.lerpVectors(start, end, t);

    // Face movement direction
    const dx = (end.x - start.x) * this.direction;
    const dz = (end.z - start.z) * this.direction;
    if (dx !== 0 || dz !== 0) {
      this.ped.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }
}

// ── Pedestrian System ───────────────────────────────────────────────
export { Pedestrian };

export class PedestrianSystem {
  constructor(scene) {
    this.scene = scene;
    this.paths = definePaths();
    this.pool = [];
    this.activeCount = 0;
    this.maxPool = DENSITY.HIGH; // 20

    // Pre-create pool
    for (let i = 0; i < this.maxPool; i++) {
      const ped = new Pedestrian();
      const npc = new NPCInstance(ped);
      npc.active = false;
      ped.mesh.visible = false;
      scene.add(ped.mesh);
      this.pool.push(npc);
    }

    // Start at medium density
    this.setDensity(DENSITY.MEDIUM);
  }

  /**
   * Activate or deactivate NPCs from the pool.
   * @param {number} count — target active count
   */
  setDensity(count) {
    count = Math.max(0, Math.min(count, this.maxPool));

    // Activate more
    while (this.activeCount < count) {
      const npc = this.pool[this.activeCount];
      this._spawnNPC(npc, this.activeCount);
      npc.active = true;
      npc.ped.mesh.visible = true;
      this.activeCount++;
    }

    // Deactivate excess
    while (this.activeCount > count) {
      this.activeCount--;
      const npc = this.pool[this.activeCount];
      npc.active = false;
      npc.ped.mesh.visible = false;
      npc.ped.setWalking(false);
    }
  }

  _spawnNPC(npc, index) {
    // Some NPCs get assigned as "standing" near interactive zones
    if (index < STANDING_POSITIONS.length) {
      const sp = STANDING_POSITIONS[index];
      npc.state = 'standing';
      npc.path = null;
      npc.ped.mesh.position.set(sp.x, 0, sp.z);
      npc.ped.mesh.rotation.y = sp.ry;
      npc.ped.setWalking(false);
      return;
    }

    // Assign a random walking path
    const pathIdx = Math.floor(Math.random() * this.paths.length);
    npc.reset(this.paths[pathIdx], 'walking');
  }

  /**
   * @param {number} dt — delta time in seconds
   * @param {THREE.Vector3} playerPosition
   */
  update(dt, playerPosition) {
    for (let i = 0; i < this.activeCount; i++) {
      const npc = this.pool[i];
      if (!npc.active) continue;

      // Distance check
      const dx = npc.ped.mesh.position.x - playerPosition.x;
      const dz = npc.ped.mesh.position.z - playerPosition.z;
      const distSq = dx * dx + dz * dz;

      // Skip everything for very far NPCs
      if (distSq > 150 * 150) continue;

      // Standing NPCs: nothing to update
      if (npc.state === 'standing') continue;

      // Idle state
      if (npc.state === 'idle') {
        npc.idleTimer += dt;
        if (npc.idleTimer >= npc.idleDuration) {
          npc.state = 'walking';
          npc.ped.setWalking(true);
        }
        continue;
      }

      // Walking state — skip animation if far but still move
      const skipAnim = distSq > 80 * 80;

      // Move along path
      if (npc.path) {
        const pathLen = npc.path.start.distanceTo(npc.path.end);
        if (pathLen > 0) {
          const step = (npc.speed * dt) / pathLen;
          npc.progress += step * npc.direction;

          // Reached an end
          if (npc.progress >= 1 || npc.progress <= 0) {
            npc.progress = Math.max(0, Math.min(1, npc.progress));
            npc.direction *= -1;

            // 30% chance to idle
            if (Math.random() < 0.3) {
              npc.state = 'idle';
              npc.idleTimer = 0;
              npc.idleDuration = 3 + Math.random() * 5; // 3-8 seconds
              npc.ped.setWalking(false);
              continue;
            }
          }

          npc._updateMeshPosition();
        }
      }

      // Animate walk
      if (!skipAnim) {
        npc.ped.animateWalk(dt);
      }
    }
  }

  getActiveCount() {
    return this.activeCount || 0;
  }

  dispose() {
    for (const npc of this.pool) {
      npc.ped.dispose();
      this.scene.remove(npc.ped.mesh);
    }
    this.pool.length = 0;
    this.activeCount = 0;
  }
}
