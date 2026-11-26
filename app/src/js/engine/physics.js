// Lightweight 2.5D collision: the player is a circle on the XZ plane, the world is a set of
// axis-aligned or oriented boxes (walls, furniture, closed doors) and circles (people).
import * as THREE from 'three';

export class Physics {
  constructor() { this.boxes = []; this.circles = []; }
  clear() { this.boxes = []; this.circles = []; }

  // center x,z ; half extents hx,hz ; rotation (rad) ; y range
  addBox(x, z, hx, hz, rot = 0, y0 = 0, y1 = 3, tag = null) {
    const b = { x, z, hx, hz, rot, y0, y1, enabled: true, tag, cos: Math.cos(rot), sin: Math.sin(rot) };
    this.boxes.push(b); return b;
  }
  setBoxTransform(b, x, z, rot) { b.x = x; b.z = z; b.rot = rot; b.cos = Math.cos(rot); b.sin = Math.sin(rot); }

  // Builds a footprint collider from an object's world bounding box (axis aligned).
  addFromObject(obj, shrink = 0.02, tag = null) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return null;
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    return this.addBox(cx, cz, Math.max(0.02, (box.max.x - box.min.x) / 2 - shrink), Math.max(0.02, (box.max.z - box.min.z) / 2 - shrink), 0, box.min.y, box.max.y, tag);
  }
  addCircle(x, z, r, tag = null) { const c = { x, z, r, enabled: true, tag }; this.circles.push(c); return c; }

  // Resolve a circle (px,pz,r) against all colliders. Returns corrected position.
  resolve(px, pz, r, feetY = 0, headY = 1.7) {
    for (let iter = 0; iter < 3; iter++) {
      for (const b of this.boxes) {
        if (!b.enabled || b.y1 < feetY + 0.25 || b.y0 > headY) continue;
        // to box local space
        const dx = px - b.x, dz = pz - b.z;
        const lx = dx * b.cos - dz * b.sin;
        const lz = dx * b.sin + dz * b.cos;
        const cx = Math.max(-b.hx, Math.min(b.hx, lx));
        const cz = Math.max(-b.hz, Math.min(b.hz, lz));
        let ox = lx - cx, oz = lz - cz;
        const d2 = ox * ox + oz * oz;
        if (d2 >= r * r) continue;
        let nx, nz, pen;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = ox / d; nz = oz / d; pen = r - d; }
        else { // centre inside box: push along smallest axis
          const px1 = b.hx - Math.abs(lx), pz1 = b.hz - Math.abs(lz);
          if (px1 < pz1) { nx = Math.sign(lx) || 1; nz = 0; pen = px1 + r; } else { nx = 0; nz = Math.sign(lz) || 1; pen = pz1 + r; }
        }
        // back to world
        const wx = nx * b.cos + nz * b.sin;
        const wz = -nx * b.sin + nz * b.cos;
        px += wx * pen; pz += wz * pen;
      }
      for (const c of this.circles) {
        if (!c.enabled) continue;
        const dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz), m = r + c.r;
        if (d < m && d > 1e-6) { px += dx / d * (m - d); pz += dz / d * (m - d); }
      }
    }
    return [px, pz];
  }
}
