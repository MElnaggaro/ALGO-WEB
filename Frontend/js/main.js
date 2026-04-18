/**
 * main.js
 * ─────────────────────────────────────────────
 * Entry point — cinematic boot sequence:
 * 1. Force scroll to top
 * 2. Load model (progress bar)
 * 3. Show "SYSTEM READY — TAP TO INITIALIZE"
 * 4. On click: fade out, play engine sound, cinematic intro
 * 5. Enable continuous scroll + mouse effects
 */

import {
  initScene, getCamera, getModelGroup, getLights, getAlive,
} from './three-scene.js';
import {
  initScrollSystem, destroyScrollSystem, playIntroAnimations,
} from './scroll-system.js';
import {
  initMouseEffects,
  setMouseEffectsEnabled,
  setModelInteraction,
} from './mouse-effects.js';
import { initEnvironment } from './environment.js';
import { transitionToDashboard, transitionToIntro } from './ui.js';

// ── Force scroll to top on every load/refresh ──
window.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
});
history.scrollRestoration = 'manual';

// ── DOM References ────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingPercent = document.getElementById('loading-percent');
const loadingTitle = document.querySelector('.loading-title');
const loadingTapHint = document.getElementById('loading-tap-hint');
const introSections = document.querySelector('.intro-sections');

// ── Audio ─────────────────────────────────────
let engineAudio = null;
let audioPlayed = false;

function initAudio() {
  engineAudio = new Audio('audio/engine.mp3');
  engineAudio.loop = false;    // Play once — cinematic moment
  engineAudio.volume = 0;
  engineAudio.preload = 'auto';
}

function startEngineSound() {
  if (!engineAudio || audioPlayed) return;
  audioPlayed = true;
  engineAudio.play().then(() => {
    // Fade in to 0.3, then fade out after 8s
    gsap.to(engineAudio, { volume: 0.3, duration: 2, ease: 'power2.out' });
    gsap.to(engineAudio, { volume: 0, duration: 3, delay: 8, ease: 'power2.in' });
  }).catch(() => {
    // Audio blocked or file missing — silently continue
  });
}

// ── Loading ───────────────────────────────────
function updateLoading(pct) {
  if (loadingBar) loadingBar.style.width = pct + '%';
  if (loadingPercent) loadingPercent.textContent = pct + '%';
}

// ── Boot ──────────────────────────────────────
function boot() {
  // Force to top immediately
  window.scrollTo(0, 0);

  const canvasContainer = document.getElementById('canvas-container');
  const particleCanvas = document.getElementById('particle-canvas');

  // Hide intro until after cinematic
  if (introSections) {
    introSections.style.opacity = '0';
    introSections.style.pointerEvents = 'none';
  }

  // Try to preload audio
  initAudio();

  // Init Three.js (Scene only, no model yet)
  initScene(canvasContainer);

  // Init environment particles
  initEnvironment(particleCanvas);

  // Perceived Performance: Fake loading bar (0 -> 100 in 1.5s)
  startFakeLoading();
}

function startFakeLoading() {
  let progress = { value: 0 };
  gsap.to(progress, {
    value: 100,
    duration: 1.5,
    ease: 'power1.inOut',
    onUpdate: () => updateLoading(Math.round(progress.value)),
    onComplete: () => showReadyState()
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// ── "SYSTEM READY" — wait for click ───────────
function showReadyState() {
  if (loadingTitle) loadingTitle.textContent = 'SYSTEM READY';
  if (loadingBar) gsap.to(loadingBar.parentElement, { opacity: 0, duration: 0.5 });
  if (loadingPercent) gsap.to(loadingPercent, { opacity: 0, duration: 0.5 });

  if (loadingTapHint) {
    loadingTapHint.style.display = 'flex';
    gsap.to(loadingTapHint, {
      opacity: 1, y: 0,
      duration: 0.8, delay: 0.5,
      ease: 'power3.out',
      onComplete: () => {
        loadingTapHint.style.animation = 'tap-pulse 2s ease-in-out infinite';
      }
    });
  }

  loadingScreen.style.cursor = 'pointer';
  loadingScreen.addEventListener('click', startCinematicIntro, { once: true });
  loadingScreen.addEventListener('touchstart', startCinematicIntro, { once: true });
}

// ── Cinematic Intro ───────────────────────────
function startCinematicIntro() {
  const camera = getCamera();
  
  // Lazy Load the model now
  import('./three-scene.js').then(mod => {
    mod.loadModel();
  });

  // Start engine sound
  startEngineSound();

  // Fade out loading screen
  gsap.to(loadingScreen, {
    opacity: 0, duration: 1.0, ease: 'power2.inOut',
    onComplete: () => loadingScreen.classList.add('hidden'),
  });

  document.body.classList.add('scanline-effect');

  // We rely on the tick in animate() or a listener to find the group
  // ── CINEMATIC TIMELINE ──
  const tl = gsap.timeline({
    delay: 0.6,
    onComplete: onIntroComplete,
  });

  // Track when group becomes available
  const checkInterval = setInterval(() => {
    const group = getModelGroup();
    if (group) {
      clearInterval(checkInterval);
      setupCarIntro(group, tl);
    }
  }, 100);
}

function setupCarIntro(group, tl) {
  const camera = getCamera();
  const alive = getAlive();

  // Setup: car tiny, below road (now Y=0), rotated
  group.scale.setScalar(0.01);
  group.position.set(0, -1.0, 5); 
  group.rotation.set(0.3, -0.8, 0.05);

  // Camera starts far back
  camera.position.set(0, 2.5, 10);

  // 1. Scale up — car materializes
  tl.to(group.scale, {
    x: 1.6, y: 1.6, z: 1.6,
    duration: 2.8, ease: 'power3.out',
  }, 0);

  // 2. Position rises to its calculated grounded height
  tl.to(group.position, {
    x: 0, y: alive.baseY, z: 1.5,
    duration: 2.8, ease: 'power3.out',
  }, 0);

  // 3. Rotation settles
  tl.to(group.rotation, {
    x: 0, y: 0, z: 0,
    duration: 3.0, ease: 'power3.out',
  }, 0);

  // 4. Camera zooms in
  tl.to(camera.position, {
    x: 0, y: 1.2, z: 6,
    duration: 2.8, ease: 'power3.out',
    onUpdate: () => camera.lookAt(0, 0.3, 0),
  }, 0);

  // 5. Lights intensify
  const lights = getLights();
  if (lights.rimBlue)      tl.from(lights.rimBlue, { intensity: 0, duration: 2.0, ease: 'power2.out' }, 0.5);
  if (lights.accentPurple) tl.from(lights.accentPurple, { intensity: 0, duration: 2.0, ease: 'power2.out' }, 0.5);
  if (lights.underGlow)    tl.from(lights.underGlow, { intensity: 0, duration: 1.5, ease: 'power2.out' }, 0.8);
}

// ── After Intro ───────────────────────────────
function onIntroComplete() {
  const camera = getCamera();
  const group = getModelGroup();
  const alive = getAlive();

  // SECTION 3: PREVENT POSITION BREAKING AFTER INTRO
  if (group) {
    gsap.killTweensOf(group.position);
    gsap.killTweensOf(group.rotation);
    
    // Reset to stable baseY stored in userData
    if (group.userData.baseY !== undefined) {
      alive.baseY = group.userData.baseY;
      group.position.y = group.userData.baseY;
    }
  }

  // Sync alive state to hero position
  alive.baseX = 0;
  alive.baseZ = 1.5;
  alive.baseScale = 1.6;

  // Show intro sections
  if (introSections) {
    introSections.style.pointerEvents = 'auto';
    gsap.to(introSections, { opacity: 1, duration: 0.8, ease: 'power3.out' });
  }

  // Init continuous scroll system
  initScrollSystem(camera);

  // Play hero text animations
  playIntroAnimations();

  // Init mouse effects (bridges scroll → scene)
  initMouseEffects(camera);

  // Bind CTA
  const startBtn = document.getElementById('start-simulation-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      setMouseEffectsEnabled(false);
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

      // Scroll back to top
      window.scrollTo({ top: 0, behavior: 'instant' });

      setTimeout(() => {
        initScrollSystem(getCamera());
      }, 900);
    });
  }

  // Dashboard clock
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const el = document.getElementById('dash-clock');
  if (!el) return;
  const now = new Date();
  el.textContent =
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
}
