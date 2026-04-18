/**
 * scroll-system.js
 * ─────────────────────────────────────────────
 * Cinematic scroll-driven transitions.
 *
 * Hero: Batmobile BIG and close, slowly rotating.
 * On scroll: smoothly pulls back, scales down,
 * rotates to new orientations per section.
 *
 * ALL transitions use GSAP with overwrite:true.
 */

import {
  setIdleRotation,
  setModelScale,
  setModelPosition,
  setModelRotation,
  setFloat,
} from './three-scene.js';

// ── Scroll States ─────────────────────────────
// Hero: car is big (1.8) and close (z:1.5)
// Subsequent sections: car pulls back, scales down
const cameraStates = [
  {
    id: 'hero',
    camera: { x: 0, y: 1.0, z: 6 },
    lookAt: { x: 0, y: 0.3, z: 0 },
    model: { pos: { x: 0, y: 0, z: 1.5 }, rot: { x: 0, y: 0, z: 0 }, scale: 1.8 },
    idle: 0.003,
    float: { amp: 0.12, speed: 0.7 },
  },
  {
    id: 'about',
    camera: { x: -3.5, y: 1.8, z: 5 },
    lookAt: { x: 0, y: 0, z: 0 },
    model: { pos: { x: 0.5, y: 0, z: 0 }, rot: { x: 0.05, y: 0.7, z: 0 }, scale: 1.1 },
    idle: 0.002,
    float: { amp: 0.08, speed: 0.6 },
  },
  {
    id: 'team',
    camera: { x: 3.5, y: 0.8, z: 4.5 },
    lookAt: { x: 0, y: 0, z: 0 },
    model: { pos: { x: -0.5, y: 0, z: 0 }, rot: { x: -0.03, y: -0.6, z: 0.02 }, scale: 1.0 },
    idle: 0.004,
    float: { amp: 0.1, speed: 0.8 },
  },
  {
    id: 'cta',
    camera: { x: 0, y: 0.6, z: 3.5 },
    lookAt: { x: 0, y: 0, z: 0 },
    model: { pos: { x: 0, y: 0, z: -0.5 }, rot: { x: 0, y: Math.PI, z: 0 }, scale: 0.9 },
    idle: 0.001,
    float: { amp: 0.06, speed: 0.5 },
  },
];

let camera = null;
let currentSection = 'hero';
let observer = null;

// Base camera position (before mouse offset)
export let baseCameraPos = { x: 0, y: 1.0, z: 6 };
export let baseCameraLookAt = { x: 0, y: 0.3, z: 0 };

// ── Init ──────────────────────────────────────
export function initScrollSystem(cam) {
  camera = cam;

  setupObserver();
  animateIntroElements();
}

// ── Section Observer ──────────────────────────
function setupObserver() {
  const sections = document.querySelectorAll('.intro-sections section');

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
          const id = entry.target.id;
          if (id !== currentSection) {
            currentSection = id;
            transitionToState(id);
          }
        }
      });
    },
    {
      threshold: [0.3, 0.5, 0.7],
    }
  );

  sections.forEach((section) => observer.observe(section));
}

// ── Transition — ALL via GSAP ─────────────────
function transitionToState(sectionId) {
  const state = cameraStates.find((s) => s.id === sectionId);
  if (!state) return;

  // Update base positions for mouse-effects integration
  baseCameraPos = { ...state.camera };
  baseCameraLookAt = { ...state.lookAt };

  // Camera position — GSAP tween
  gsap.to(camera.position, {
    x: state.camera.x,
    y: state.camera.y,
    z: state.camera.z,
    duration: 1.8,
    ease: 'power3.out',
    overwrite: true,
    onUpdate: () => {
      camera.lookAt(
        baseCameraLookAt.x,
        baseCameraLookAt.y,
        baseCameraLookAt.z
      );
    },
  });

  // Model transforms — all via smooth API
  setModelPosition(state.model.pos.x, state.model.pos.y, state.model.pos.z, 1.8);
  setModelRotation(state.model.rot.x, state.model.rot.y, state.model.rot.z, 2.0);
  setModelScale(state.model.scale, 1.8);
  setIdleRotation(state.idle);
  setFloat(state.float.amp, state.float.speed);

  // Animate section content
  animateSectionContent(sectionId);
}

// ── Section Content Animations ────────────────
function animateSectionContent(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const elements = section.querySelectorAll('.fade-in-up, .stagger-in > *');

  gsap.fromTo(
    elements,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
    }
  );
}

// ── Intro Animations (dramatic entrance) ──────
function animateIntroElements() {
  const tl = gsap.timeline({ delay: 0.5 });

  // Title entrance with dramatic timing
  tl.fromTo(
    '.hero-badge',
    { opacity: 0, y: 30, scale: 0.8 },
    { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out' }
  )
    .fromTo(
      '.hero-title',
      { opacity: 0, y: 60, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'power3.out' },
      '-=0.4'
    )
    .fromTo(
      '.hero-subtitle',
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
      '-=0.5'
    )
    .fromTo(
      '.scroll-indicator',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      '-=0.2'
    );
}

// ── Public ────────────────────────────────────
export function getCurrentSection() {
  return currentSection;
}

export function destroyScrollSystem() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}
