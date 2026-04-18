/**
 * main.js
 * ─────────────────────────────────────────────
 * Entry point — orchestrates all modules with
 * cinematic boot sequence and smooth transitions.
 */

import {
  initScene, getCamera, getModelGroup, getLights, getScene,
  setIdleRotation, setModelScale, setModelPosition,
} from './three-scene.js';
import { initScrollSystem, destroyScrollSystem } from './scroll-system.js';
import {
  initMouseEffects,
  setMouseEffectsEnabled,
  setModelInteraction,
} from './mouse-effects.js';
import { initEnvironment } from './environment.js';
import { transitionToDashboard, transitionToIntro } from './ui.js';

// ── Loading ───────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingPercent = document.getElementById('loading-percent');

function updateLoading(pct) {
  if (loadingBar) loadingBar.style.width = pct + '%';
  if (loadingPercent) loadingPercent.textContent = pct + '%';
}

function hideLoading() {
  // Dramatic delay before reveal
  setTimeout(() => {
    if (loadingScreen) {
      gsap.to(loadingScreen, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          loadingScreen.classList.add('hidden');
        },
      });
    }
  }, 600);
}

// ── Boot ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const canvasContainer = document.getElementById('canvas-container');
  const particleCanvas = document.getElementById('particle-canvas');

  // Init Three.js scene
  initScene(canvasContainer, {
    onProgress: (pct) => updateLoading(pct),
    onLoad: () => {
      updateLoading(100);
      hideLoading();
      // Small delay to let loading fade out before starting animations
      setTimeout(onSceneReady, 1000);
    },
  });

  // Init environment particles
  initEnvironment(particleCanvas);

  // Scanline effect
  document.body.classList.add('scanline-effect');
});

// ── Scene Ready ───────────────────────────────
function onSceneReady() {
  const camera = getCamera();

  // Init scroll-driven camera transitions
  initScrollSystem(camera);

  // Init mouse parallax + model interaction
  initMouseEffects(camera);

  // Cinematic entrance — model glides into position
  cinematicEntrance();

  // Bind CTA button
  const startBtn = document.getElementById('start-simulation-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      setMouseEffectsEnabled(false);
      setModelInteraction(false);
      destroyScrollSystem();
      transitionToDashboard();
    });
  }

  // Bind back button
  const backBtn = document.getElementById('back-to-intro-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      transitionToIntro();
      setMouseEffectsEnabled(true);
      setModelInteraction(true);

      setTimeout(() => {
        const cam = getCamera();
        initScrollSystem(cam);
      }, 900);
    });
  }

  // Dashboard clock
  updateClock();
  setInterval(updateClock, 1000);
}

// ── Cinematic Entrance ────────────────────────
function cinematicEntrance() {
  const group = getModelGroup();
  if (!group) return;

  // Start invisible and slightly offset
  group.scale.setScalar(0.01);
  group.position.set(0, -1, 5);
  group.rotation.set(0.2, -0.5, 0);

  // Dramatic zoom-in entrance
  const tl = gsap.timeline({ delay: 0.2 });

  // Scale up dramatically
  tl.to(group.scale, {
    x: 1.8, y: 1.8, z: 1.8,
    duration: 2.0,
    ease: 'power3.out',
  });

  // Position into hero state
  tl.to(group.position, {
    x: 0, y: 0, z: 1.5,
    duration: 2.0,
    ease: 'power3.out',
  }, '<');

  // Rotation settle
  tl.to(group.rotation, {
    x: 0, y: 0, z: 0,
    duration: 2.2,
    ease: 'power3.out',
  }, '<');
}

// ── Clock ─────────────────────────────────────
function updateClock() {
  const el = document.getElementById('dash-clock');
  if (!el) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
}
