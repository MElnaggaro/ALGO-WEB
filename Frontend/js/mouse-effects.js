/**
 * mouse-effects.js
 * ─────────────────────────────────────────────
 * Cinematic parallax: mouse controls BOTH
 * camera offset AND model rotation for
 * an interactive hero experience.
 *
 * Uses lerp (0.03) — never direct set.
 */

import { baseCameraPos, baseCameraLookAt } from './scroll-system.js';
import { getModelGroup } from './three-scene.js';

let camera = null;
let enabled = true;
let rafId = null;
let modelInteraction = true; // car rotates with mouse in hero

// Mouse state
const mouse = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };

// Model rotation target (from mouse)
const modelMouseRot = { x: 0, y: 0 };
const modelMouseSmooth = { x: 0, y: 0 };

// Config
const LERP = 0.03;
const CAMERA_INTENSITY = { x: 0.35, y: 0.2 };
const MODEL_ROT_INTENSITY = { x: 0.08, y: 0.15 };

// ── Init ──────────────────────────────────────
export function initMouseEffects(cam) {
  camera = cam;
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  update();
}

// ── Mouse Handler ─────────────────────────────
function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
}

// ── Update Loop — LERP interpolation ──────────
function update() {
  rafId = requestAnimationFrame(update);

  if (!camera || !enabled) return;

  // Smooth interpolation (lerp)
  smooth.x += (mouse.x - smooth.x) * LERP;
  smooth.y += (mouse.y - smooth.y) * LERP;

  // Camera offset — additive on scroll position
  camera.position.x = baseCameraPos.x + smooth.x * CAMERA_INTENSITY.x;
  camera.position.y = baseCameraPos.y - smooth.y * CAMERA_INTENSITY.y;
  // Keep z from scroll system
  camera.position.z = baseCameraPos.z;

  // Look at with slight offset for parallax depth
  camera.lookAt(
    baseCameraLookAt.x + smooth.x * 0.1,
    baseCameraLookAt.y - smooth.y * 0.05,
    baseCameraLookAt.z
  );

  // Model rotation from mouse (hero interactive feel)
  if (modelInteraction) {
    const group = getModelGroup();
    if (group) {
      modelMouseRot.x = -mouse.y * MODEL_ROT_INTENSITY.x;
      modelMouseRot.y = mouse.x * MODEL_ROT_INTENSITY.y;

      modelMouseSmooth.x += (modelMouseRot.x - modelMouseSmooth.x) * LERP;
      modelMouseSmooth.y += (modelMouseRot.y - modelMouseSmooth.y) * LERP;

      // Add mouse rotation on top of idle (additive)
      // The idle rotation in animate() already handles base rotation
      // We add a small delta here
      group.rotation.x += (modelMouseSmooth.x - group.rotation.x) * 0.01;
      // Don't override y since idle rotation adds to it
    }
  }
}

// ── Enable/Disable ────────────────────────────
export function setMouseEffectsEnabled(state) {
  enabled = state;
}

export function setModelInteraction(state) {
  modelInteraction = state;
}

// ── Cleanup ───────────────────────────────────
export function destroyMouseEffects() {
  window.removeEventListener('mousemove', onMouseMove);
  cancelAnimationFrame(rafId);
}
