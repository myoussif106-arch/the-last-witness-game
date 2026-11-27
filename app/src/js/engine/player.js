import * as THREE from 'three';
import { audio } from '../core/audio.js';

// First-person controller: mouse look (pointer lock), WASD, Shift to walk faster, C to crouch.
export class Player {
  constructor(camera, dom, physics) {
    this.camera = camera; this.dom = dom; this.physics = physics;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector2();
    this.height = 1.68; this.crouch = 0; this.radius = 0.28;
    this.keys = {};
    this.enabled = false;
    this.sensitivity = 1; this.invertY = false; this.headBob = true;
    this.bob = 0; this.stepAcc = 0;
    this.surfaceAt = () => 'wood';

    document.addEventListener('keydown', e => { this.keys[e.code] = true; });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('mousemove', e => {
      if (!this.enabled || document.pointerLockElement !== this.dom) return;
      const s = 0.0022 * this.sensitivity;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s * (this.invertY ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
  }

  lock() { if (document.pointerLockElement !== this.dom) { try { const p = this.dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {} } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  get locked() { return document.pointerLockElement === this.dom; }

  setPose(x, z, yaw, pitch = 0) { this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = pitch; this.vel.set(0, 0); this.apply(0); }

  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt) {
    if (!this.enabled) { this.vel.set(0, 0); return; }
    const k = this.keys;
    let fx = 0, fz = 0;
    if (k.KeyW || k.ArrowUp) fz += 1;
    if (k.KeyS || k.ArrowDown) fz -= 1;
    if (k.KeyA || k.ArrowLeft) fx -= 1;
    if (k.KeyD || k.ArrowRight) fx += 1;
    // on-screen joystick + drag-to-look (phones)
    let stickMag = 0;
    if (this.touch) {
      const m = this.touch.move; stickMag = Math.min(1, Math.hypot(m.x, m.y));
      if (stickMag > 0.12) { fx += m.x; fz += m.y; }
      const d = this.touch.takeLook(), s = 0.0045 * this.sensitivity;
      this.yaw -= d.x * s; this.pitch -= d.y * s * (this.invertY ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
    const crouching = !!k.KeyC;
    this.crouch += ((crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);
    const run = ((k.ShiftLeft || k.ShiftRight) || stickMag > 0.97) && !crouching;
    const speed = crouching ? 1.1 : run ? 3.4 : 1.9;
    const len = Math.hypot(fx, fz);
    const target = new THREE.Vector2();
    if (len > 0) {
      fx /= len; fz /= len;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      target.set((-s * fz + c * fx) * speed, (-c * fz - s * fx) * speed);
    }
    const accel = len > 0 ? 10 : 12;
    this.vel.x += (target.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.y += (target.y - this.vel.y) * Math.min(1, dt * accel);
    let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    [nx, nz] = this.physics.resolve(nx, nz, this.radius, 0, this.height);
    const moved = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.pos.x = nx; this.pos.z = nz;

    // head bob + footsteps
    const sp = moved / Math.max(dt, 1e-4);
    if (sp > 0.3) {
      this.bob += dt * sp * 4.2;
      this.stepAcc += moved;
      const stride = run ? 0.85 : 0.68;
      if (this.stepAcc > stride) { this.stepAcc = 0; audio.step(this.surfaceAt(this.pos.x, this.pos.z), run); }
    } else this.bob += (Math.round(this.bob / Math.PI) * Math.PI - this.bob) * Math.min(1, dt * 6);
    this.apply(dt, sp);
  }

  apply(dt, sp = 0) {
    const bobAmt = this.headBob ? Math.min(1, sp / 2) : 0;
    const eye = this.height - this.crouch * 0.55 + Math.abs(Math.sin(this.bob)) * 0.035 * bobAmt - 0.017 * bobAmt;
    this.camera.position.set(this.pos.x + Math.cos(this.bob) * 0.012 * bobAmt, eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.004 * bobAmt, 'YXZ');
  }
}
