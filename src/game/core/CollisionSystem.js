import * as THREE from 'three';

export class CollisionSystem {
  constructor() {
    // Array of AABB bounding boxes { minX, maxX, minZ, maxZ, height, type }
    this.staticBoxes = [];
  }

  addBox(minX, maxX, minZ, maxZ, height = 20, type = 'building') {
    this.staticBoxes.push({
      minX,
      maxX,
      minZ,
      maxZ,
      height,
      type
    });
  }

  checkAndResolve(currentPos, nextPos, radius) {
    let resolvedX = nextPos.x;
    let resolvedZ = nextPos.z;
    let collided = false;

    for (let i = 0; i < this.staticBoxes.length; i++) {
      const box = this.staticBoxes[i];

      // Expand AABB by collision radius
      const expandedMinX = box.minX - radius;
      const expandedMaxX = box.maxX + radius;
      const expandedMinZ = box.minZ - radius;
      const expandedMaxZ = box.maxZ + radius;

      // Check if next position penetrates the expanded AABB
      if (
        resolvedX >= expandedMinX &&
        resolvedX <= expandedMaxX &&
        resolvedZ >= expandedMinZ &&
        resolvedZ <= expandedMaxZ
      ) {
        collided = true;

        // Calculate penetration depths along all 4 cardinal directions
        const pushLeft = resolvedX - expandedMinX;
        const pushRight = expandedMaxX - resolvedX;
        const pushTop = resolvedZ - expandedMinZ;
        const pushBottom = expandedMaxZ - resolvedZ;

        const minPenetration = Math.min(pushLeft, pushRight, pushTop, pushBottom);

        if (minPenetration === pushLeft) {
          resolvedX = expandedMinX;
        } else if (minPenetration === pushRight) {
          resolvedX = expandedMaxX;
        } else if (minPenetration === pushTop) {
          resolvedZ = expandedMinZ;
        } else {
          resolvedZ = expandedMaxZ;
        }
      }
    }

    return {
      collided,
      resolvedPosition: new THREE.Vector3(resolvedX, nextPos.y, resolvedZ)
    };
  }
}
