/**
 * mouse-effects.js
 * ─────────────────────────────────────────────
 * Smooth camera parallax via LERP.
 *
 * The scroll system writes baseCameraPos/LookAt
 * continuously. This module reads those and
 * applies mouse offset — never fights scroll.
 */

import { baseCameraPos, baseCameraLookAt, getScrollState } from './scroll-system.js';
import { getCamera, getAlive } from './three-scene.js';

let camera = null;
let enabled = true;
let rafId = null;

const mouse = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };

const LERP = 0.04;
const INTENSITY = { x: 0.25, y: 0.12 };

export function initMouseEffects(cam) {
  camera = cam;
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  update();
}

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
}

function update() {
  rafId = requestAnimationFrame(update);
  if (!camera || !enabled) return;

  // Smooth mouse
  smooth.x += (mouse.x - smooth.x) * LERP;
  smooth.y += (mouse.y - smooth.y) * LERP;

  // Read continuous scroll state and apply mouse offset
  const state = getScrollState();
  const offsetX = smooth.x * INTENSITY.x;
  const offsetY = -smooth.y * INTENSITY.y;

  camera.position.x = state.camX + offsetX;
  camera.position.y = state.camY + offsetY;
  camera.position.z = state.camZ;

  camera.lookAt(
    state.lookX + smooth.x * 0.06,
    state.lookY - smooth.y * 0.03,
    state.lookZ || 0
  );

  // Also sync alive base values from scroll state
  const alive = getAlive();
  alive.baseX = state.modelX;
  alive.baseY = state.modelY;
  alive.baseZ = state.modelZ;
  alive.baseRX = state.modelRX;
  alive.baseRY = state.modelRY;
  alive.baseRZ = state.modelRZ;
  alive.baseScale = state.modelScale;
  alive.floatAmp = state.floatAmp;
  alive.floatSpeed = state.floatSpeed;
  alive.idleSpeed = state.idle;
}

export function setMouseEffectsEnabled(val) {
  enabled = val;
}

export function setModelInteraction(val) {
  // alive motion handles model interaction now
}

export function destroyMouseEffects() {
  window.removeEventListener('mousemove', onMouseMove);
  cancelAnimationFrame(rafId);
}
