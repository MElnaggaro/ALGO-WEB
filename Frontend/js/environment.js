/**
 * environment.js
 * ─────────────────────────────────────────────
 * Cinematic environment: particles, dramatic
 * day/night system, emergency mode effects,
 * fog density, emissive material animation.
 */

import * as THREE from 'three';
import {
  getLights, getScene, getModelGroup,
  setRoadState, setModelEmissive,
  getRoadLines, getRoadEdges,
} from './three-scene.js';

let canvas, ctx;
let particles = [];
let currentMode = 'night';
let isEmergency = false;
let animId = null;

// ── Color Palettes — dramatic differences ─────
const palettes = {
  night: {
    particles: ['#00c3ff', '#7a00ff', '#0088cc', '#5500cc', '#00ff88'],
    fog: { color: 0x050505, density: 0.04 },
    ambient: { color: 0x111122, intensity: 0.4 },
    directional: { color: 0xeeeeff, intensity: 1.0 },
    rimBlue: { intensity: 4 },
    accentPurple: { intensity: 2.5 },
    underGlow: { color: 0x00c3ff, intensity: 2.5 },
    headlight: { intensity: 1.5 },
    toneMappingExposure: 1.3,
    modelEmissive: { color: 0x001122, intensity: 0.3 },
  },
  morning: {
    particles: ['#ffd080', '#ffaa44', '#ff9933', '#ffcc66', '#ffe0b0'],
    fog: { color: 0x1a1520, density: 0.025 },
    ambient: { color: 0x443322, intensity: 0.9 },
    directional: { color: 0xffeedd, intensity: 1.8 },
    rimBlue: { intensity: 1.5 },
    accentPurple: { intensity: 0.8 },
    underGlow: { color: 0xffaa44, intensity: 1.0 },
    headlight: { intensity: 0.5 },
    toneMappingExposure: 1.8,
    modelEmissive: { color: 0x221100, intensity: 0.1 },
  },
  day: {
    particles: ['#88bbff', '#66aaff', '#aaccff', '#ccddff', '#77bbee'],
    fog: { color: 0x2a3040, density: 0.02 },
    ambient: { color: 0x556677, intensity: 1.3 },
    directional: { color: 0xffffff, intensity: 2.2 },
    rimBlue: { intensity: 1.0 },
    accentPurple: { intensity: 0.5 },
    underGlow: { color: 0x4488cc, intensity: 0.6 },
    headlight: { intensity: 0.3 },
    toneMappingExposure: 2.0,
    modelEmissive: { color: 0x000000, intensity: 0.0 },
  },
};

// ── Particle Class ────────────────────────────
class Particle {
  constructor(w, h, palette) {
    this.reset(w, h, palette);
  }

  reset(w, h, palette) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.size = Math.random() * 2.5 + 0.3;
    this.speedX = (Math.random() - 0.5) * 0.4;
    this.speedY = (Math.random() - 0.5) * 0.25 - 0.08;
    this.opacity = Math.random() * 0.5 + 0.05;
    this.opacityDir = (Math.random() - 0.5) * 0.006;
    this.color = palette[Math.floor(Math.random() * palette.length)];
    this.w = w;
    this.h = h;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.opacity += this.opacityDir;
    if (this.opacity <= 0.03 || this.opacity >= 0.55) this.opacityDir *= -1;

    if (this.x < -10) this.x = this.w + 10;
    if (this.x > this.w + 10) this.x = -10;
    if (this.y < -10) this.y = this.h + 10;
    if (this.y > this.h + 10) this.y = -10;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.opacity;
    ctx.fill();

    // Glow halo
    if (this.size > 1.0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity * 0.06;
      ctx.fill();
    }
  }
}

// ── Init ──────────────────────────────────────
export function initEnvironment(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');

  resizeCanvas();
  createParticles();
  animate();

  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticles() {
  const palette = palettes[currentMode].particles;
  particles = [];
  for (let i = 0; i < 200; i++) {
    particles.push(new Particle(canvas.width, canvas.height, palette));
  }
}

function animate() {
  animId = requestAnimationFrame(animate);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    p.update();
    p.draw(ctx);
  }
  ctx.globalAlpha = 1;
}

// ── Set Mode — DRAMATIC transitions ───────────
export function setMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;

  const p = palettes[mode];
  if (!p) return;

  const scene = getScene();
  const lights = getLights();
  const renderer = document.getElementById('three-canvas')?.__renderer;

  // Re-color particles smoothly
  particles.forEach((pt) => {
    pt.color = p.particles[Math.floor(Math.random() * p.particles.length)];
  });

  // ── Scene fog ──
  if (scene && scene.fog) {
    const fogColor = new THREE.Color(p.fog.color);
    gsap.to(scene.fog.color, {
      r: fogColor.r, g: fogColor.g, b: fogColor.b,
      duration: 1.8, ease: 'power2.inOut',
    });
    gsap.to(scene.fog, {
      density: p.fog.density,
      duration: 1.8, ease: 'power2.inOut',
    });
  }

  // ── Lights — dramatic ──
  if (lights) {
    // Ambient
    if (lights.ambient) {
      const ac = new THREE.Color(p.ambient.color);
      gsap.to(lights.ambient.color, { r: ac.r, g: ac.g, b: ac.b, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(lights.ambient, { intensity: p.ambient.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    // Directional
    if (lights.directional) {
      const dc = new THREE.Color(p.directional.color);
      gsap.to(lights.directional.color, { r: dc.r, g: dc.g, b: dc.b, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(lights.directional, { intensity: p.directional.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    // Rim blue
    if (lights.rimBlue) {
      gsap.to(lights.rimBlue, { intensity: p.rimBlue.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    // Accent purple
    if (lights.accentPurple) {
      gsap.to(lights.accentPurple, { intensity: p.accentPurple.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    // Under glow
    if (lights.underGlow) {
      const uc = new THREE.Color(p.underGlow.color);
      gsap.to(lights.underGlow.color, { r: uc.r, g: uc.g, b: uc.b, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(lights.underGlow, { intensity: p.underGlow.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    // Headlight
    if (lights.headlight) {
      gsap.to(lights.headlight, { intensity: p.headlight.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
  }

  // Model emissive
  setModelEmissive(p.modelEmissive.color, p.modelEmissive.intensity, 1.5);

  // CSS class for body
  document.body.classList.remove('day-mode', 'morning-mode', 'night-mode');
  document.body.classList.add(mode + '-mode');
}

// ── Emergency Mode ────────────────────────────
export function setEmergencyMode(active) {
  if (active === isEmergency) return;
  isEmergency = active;

  const lights = getLights();

  if (active) {
    // Red overlay
    document.body.classList.add('emergency-mode');

    // Road turns red
    setRoadState('heavy');

    // Lights go red/intense
    if (lights.underGlow) {
      gsap.to(lights.underGlow.color, { r: 1, g: 0.15, b: 0.15, duration: 0.8, ease: 'power2.out' });
      gsap.to(lights.underGlow, { intensity: 5, duration: 0.8, ease: 'power2.out' });
    }
    if (lights.rimBlue) {
      gsap.to(lights.rimBlue.color, { r: 1, g: 0.2, b: 0.2, duration: 0.8, ease: 'power2.out' });
      gsap.to(lights.rimBlue, { intensity: 6, duration: 0.8, ease: 'power2.out' });
    }

    // Model glow
    setModelEmissive(0xff2222, 0.6, 0.8);

    // Fog denser
    const scene = getScene();
    if (scene && scene.fog) {
      gsap.to(scene.fog, { density: 0.07, duration: 1.0, ease: 'power2.out' });
    }

    // Re-color particles red
    particles.forEach((pt) => {
      pt.color = ['#ff3b3b', '#ff6644', '#ff2222', '#cc1111', '#ff4444'][Math.floor(Math.random() * 5)];
    });
  } else {
    document.body.classList.remove('emergency-mode');

    // Restore to current mode
    setRoadState('optimal');
    setMode(currentMode === currentMode ? currentMode : 'night'); // force re-apply

    // Re-apply current mode lights
    const p = palettes[currentMode];
    if (lights.underGlow) {
      const uc = new THREE.Color(p.underGlow.color);
      gsap.to(lights.underGlow.color, { r: uc.r, g: uc.g, b: uc.b, duration: 1.2, ease: 'power2.out' });
      gsap.to(lights.underGlow, { intensity: p.underGlow.intensity, duration: 1.2, ease: 'power2.out' });
    }
    if (lights.rimBlue) {
      gsap.to(lights.rimBlue.color, { r: 0, g: 0.76, b: 1, duration: 1.2, ease: 'power2.out' });
      gsap.to(lights.rimBlue, { intensity: p.rimBlue.intensity, duration: 1.2, ease: 'power2.out' });
    }

    setModelEmissive(p.modelEmissive.color, p.modelEmissive.intensity, 1.2);

    const scene = getScene();
    if (scene && scene.fog) {
      gsap.to(scene.fog, { density: p.fog.density, duration: 1.2, ease: 'power2.out' });
    }

    // Restore particles
    particles.forEach((pt) => {
      pt.color = p.particles[Math.floor(Math.random() * p.particles.length)];
    });
  }
}

// ── Getters ───────────────────────────────────
export function getMode() {
  return currentMode;
}

export function getIsEmergency() {
  return isEmergency;
}

// ── Cleanup ───────────────────────────────────
export function destroyEnvironment() {
  cancelAnimationFrame(animId);
  window.removeEventListener('resize', resizeCanvas);
}
