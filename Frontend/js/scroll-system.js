/**
 * scroll-system.js
 * ─────────────────────────────────────────────
 * CONTINUOUS scroll interpolation system.
 *
 * Instead of IntersectionObserver (hard cuts),
 * we track scrollProgress = scrollY / totalHeight
 * and LERP between section states continuously.
 *
 * Result: camera and model glide smoothly through
 * all sections — no snapping, no cuts.
 */

import {
  getModelGroup, getCamera,
  setRoadSpeed, setAliveMotion,
} from './three-scene.js';

// ── Section keyframes — scroll ranges ─────────
// Each section occupies a 0–1 range of scroll progress
const keyframes = [
  {
    id: 'hero',
    range: [0, 0.25],
    camera: { x: 0, y: 1.2, z: 6 },
    lookAt: { x: 0, y: 0.3, z: 0 },
    model: { x: 0, y: 0.5, z: 1.5, rx: 0, ry: 0, rz: 0, scale: 1.6 },
    idle: 0.002,
    floatAmp: 0.06,
    floatSpeed: 0.7,
    sway: { amplitude: 0.08, speed: 0.3 },
    tilt: { amplitude: 0.015, speed: 0.25 },
    roadSpeed: 0.05,
  },
  {
    id: 'about',
    range: [0.25, 0.5],
    camera: { x: -2.5, y: 1.6, z: 5.5 },
    lookAt: { x: 0, y: 0.2, z: 0 },
    model: { x: 1.0, y: 0.5, z: 0.5, rx: 0.03, ry: 0.8, rz: -0.02, scale: 1.15 },
    idle: 0.001,
    floatAmp: 0.04,
    floatSpeed: 0.5,
    sway: { amplitude: 0.05, speed: 0.2 },
    tilt: { amplitude: 0.01, speed: 0.2 },
    roadSpeed: 0.07,
  },
  {
    id: 'team',
    range: [0.5, 0.75],
    camera: { x: 2.5, y: 0.9, z: 5 },
    lookAt: { x: 0, y: 0.1, z: 0 },
    model: { x: -0.8, y: 0.5, z: 0, rx: -0.02, ry: -0.7, rz: 0.02, scale: 1.05 },
    idle: 0.003,
    floatAmp: 0.05,
    floatSpeed: 0.65,
    sway: { amplitude: 0.06, speed: 0.25 },
    tilt: { amplitude: 0.012, speed: 0.22 },
    roadSpeed: 0.06,
  },
  {
    id: 'cta',
    range: [0.75, 1.0],
    camera: { x: 0, y: 0.7, z: 3.8 },
    lookAt: { x: 0, y: 0.1, z: 0 },
    model: { x: 0, y: 0.5, z: -0.3, rx: 0, ry: Math.PI * 0.65, rz: 0, scale: 0.95 },
    idle: 0.0015,
    floatAmp: 0.04,
    floatSpeed: 0.5,
    sway: { amplitude: 0.04, speed: 0.2 },
    tilt: { amplitude: 0.008, speed: 0.18 },
    roadSpeed: 0.04,
  },
];

// ── Interpolation State ───────────────────────
let camera = null;
let enabled = false;
let rafId = null;
let lastSection = '';

// Current smoothed values (lerp targets)
const current = {
  camX: 0, camY: 1.2, camZ: 6,
  lookX: 0, lookY: 0.3, lookZ: 0,
  modelX: 0, modelY: 0.5, modelZ: 1.5,
  modelRX: 0, modelRY: 0, modelRZ: 0,
  modelScale: 1.6,
  floatAmp: 0.06, floatSpeed: 0.7,
  idle: 0.002,
};

const LERP_SPEED = 0.06; // smooth but responsive

// Export for mouse-effects to read
export let baseCameraPos = { x: 0, y: 1.2, z: 6 };
export let baseCameraLookAt = { x: 0, y: 0.3, z: 0 };

// ── Init ──────────────────────────────────────
export function initScrollSystem(cam) {
  camera = cam;
  enabled = true;

  // Start continuous update loop
  if (!rafId) update();
}

export function playIntroAnimations() {
  animateIntroElements();
}

// ── Core: continuous per-frame interpolation ──
function update() {
  rafId = requestAnimationFrame(update);
  if (!camera || !enabled) return;

  const group = getModelGroup();
  if (!group) return;

  // Get scroll progress (0 to 1)
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollHeight > 0 ? Math.max(0, Math.min(1, window.scrollY / scrollHeight)) : 0;

  // Find which two keyframes we're between
  const target = getInterpolatedState(progress);

  // LERP all values smoothly toward target
  current.camX += (target.camX - current.camX) * LERP_SPEED;
  current.camY += (target.camY - current.camY) * LERP_SPEED;
  current.camZ += (target.camZ - current.camZ) * LERP_SPEED;
  current.lookX += (target.lookX - current.lookX) * LERP_SPEED;
  current.lookY += (target.lookY - current.lookY) * LERP_SPEED;
  current.modelX += (target.modelX - current.modelX) * LERP_SPEED;
  current.modelY += (target.modelY - current.modelY) * LERP_SPEED;
  current.modelZ += (target.modelZ - current.modelZ) * LERP_SPEED;
  current.modelRX += (target.modelRX - current.modelRX) * LERP_SPEED;
  current.modelRY += (target.modelRY - current.modelRY) * LERP_SPEED;
  current.modelRZ += (target.modelRZ - current.modelRZ) * LERP_SPEED;
  current.modelScale += (target.modelScale - current.modelScale) * LERP_SPEED;
  current.floatAmp += (target.floatAmp - current.floatAmp) * LERP_SPEED;
  current.floatSpeed += (target.floatSpeed - current.floatSpeed) * LERP_SPEED;
  current.idle += (target.idle - current.idle) * LERP_SPEED;

  // Update base camera for mouse-effects
  baseCameraPos.x = current.camX;
  baseCameraPos.y = current.camY;
  baseCameraPos.z = current.camZ;
  baseCameraLookAt.x = current.lookX;
  baseCameraLookAt.y = current.lookY;

  // Section change detection (for content animations)
  if (target.sectionId !== lastSection) {
    lastSection = target.sectionId;
    animateSectionContent(target.sectionId);

    // Update alive motion and road speed via GSAP (these are less frequent)
    setAliveMotion(target.sway, target.tilt);
    setRoadSpeed(target.roadSpeed);
  }
}

// ── Interpolate between keyframes ─────────────
function getInterpolatedState(progress) {
  // Find the keyframe pair we're between
  let kA = keyframes[0];
  let kB = keyframes[0];
  let t = 0;

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    if (progress >= kf.range[0] && progress <= kf.range[1]) {
      // Within this keyframe's range
      kA = kf;
      kB = keyframes[Math.min(i + 1, keyframes.length - 1)];
      t = (progress - kf.range[0]) / (kf.range[1] - kf.range[0]);
      break;
    }
  }

  // Smooth easing on t (ease-in-out)
  t = t * t * (3 - 2 * t);

  // Interpolate between A and B
  const lerp = (a, b) => a + (b - a) * t;

  return {
    sectionId: kA.id,
    camX: lerp(kA.camera.x, kB.camera.x),
    camY: lerp(kA.camera.y, kB.camera.y),
    camZ: lerp(kA.camera.z, kB.camera.z),
    lookX: lerp(kA.lookAt.x, kB.lookAt.x),
    lookY: lerp(kA.lookAt.y, kB.lookAt.y),
    modelX: lerp(kA.model.x, kB.model.x),
    modelY: lerp(kA.model.y, kB.model.y),
    modelZ: lerp(kA.model.z, kB.model.z),
    modelRX: lerp(kA.model.rx, kB.model.rx),
    modelRY: lerp(kA.model.ry, kB.model.ry),
    modelRZ: lerp(kA.model.rz, kB.model.rz),
    modelScale: lerp(kA.model.scale, kB.model.scale),
    floatAmp: lerp(kA.floatAmp, kB.floatAmp),
    floatSpeed: lerp(kA.floatSpeed, kB.floatSpeed),
    idle: lerp(kA.idle, kB.idle),
    sway: kA.sway,
    tilt: kA.tilt,
    roadSpeed: kA.roadSpeed,
  };
}

// ── Section Content Animations ────────────────
function animateSectionContent(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const elements = section.querySelectorAll('.fade-in-up, .stagger-in > *');
  gsap.fromTo(elements,
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }
  );
}

// ── Intro title animations ────────────────────
function animateIntroElements() {
  const tl = gsap.timeline({ delay: 0.3 });

  tl.fromTo('.hero-badge',
    { opacity: 0, y: 30, scale: 0.8 },
    { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out' }
  )
  .fromTo('.hero-title',
    { opacity: 0, y: 60, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'power3.out' },
    '-=0.4'
  )
  .fromTo('.hero-subtitle',
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
    '-=0.5'
  )
  .fromTo('.scroll-indicator',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
    '-=0.2'
  );
}

// ── Public getters ────────────────────────────
export function getCurrentSection() {
  return lastSection;
}

export function getScrollState() {
  return current;
}

export function destroyScrollSystem() {
  enabled = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
