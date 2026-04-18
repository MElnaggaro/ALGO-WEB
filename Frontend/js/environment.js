/**
 * environment.js
 * ─────────────────────────────────────────────
 * Interactive canvas environment:
 * - Mouse-reactive particles (parallax)
 * - Twinkling stars (night only)
 * - Morning gradient sky with haze
 * - Emergency overlay (DOM-based)
 * - Reduced particle count for performance
 */

import * as THREE from 'three';
import {
  getLights, getScene,
  setRoadState, setModelEmissive,
} from './three-scene.js';

let canvas, ctx;
let particles = [];
let stars = [];
let currentMode = 'night';
let isEmergency = false;
let animId = null;
let emergencyOverlay = null;

// Mouse state for interactive particles
const envMouse = { x: 0, y: 0 };
const envSmooth = { x: 0, y: 0 };

// Morning sky gradient state
let skyGradientOpacity = 0;
let targetSkyOpacity = 0;

// ── Color Palettes ────────────────────────────
const palettes = {
  night: {
    particles: ['#00c3ff', '#7a00ff', '#0088cc', '#5500cc', '#00ff88'],
    stars: true,
    skyGradient: false,
    fog: { color: 0x050505, density: 0.035 },
    ambient: { color: 0x111122, intensity: 0.4 },
    directional: { color: 0xeeeeff, intensity: 1.0 },
    rimBlue: { intensity: 4 },
    accentPurple: { intensity: 2.5 },
    underGlow: { color: 0x00c3ff, intensity: 2.5 },
    headlight: { intensity: 1.5 },
    modelEmissive: { color: 0x001122, intensity: 0.3 },
  },
  morning: {
    particles: ['#ffcc88', '#ffaa55', '#ff9944', '#ffddb0', '#ffe8cc'],
    stars: false,
    skyGradient: true,
    fog: { color: 0x2a1810, density: 0.02 },
    ambient: { color: 0x665540, intensity: 1.1 },
    directional: { color: 0xffe0b0, intensity: 2.0 },
    rimBlue: { intensity: 0.8 },
    accentPurple: { intensity: 0.4 },
    underGlow: { color: 0xff9944, intensity: 1.2 },
    headlight: { intensity: 0.3 },
    modelEmissive: { color: 0x331a00, intensity: 0.15 },
  },
  day: {
    particles: ['#88bbff', '#66aaff', '#aaccff', '#ccddff', '#77bbee'],
    stars: false,
    skyGradient: false,
    fog: { color: 0x2a3040, density: 0.02 },
    ambient: { color: 0x556677, intensity: 1.3 },
    directional: { color: 0xffffff, intensity: 2.2 },
    rimBlue: { intensity: 1.0 },
    accentPurple: { intensity: 0.5 },
    underGlow: { color: 0x4488cc, intensity: 0.6 },
    headlight: { intensity: 0.3 },
    modelEmissive: { color: 0x000000, intensity: 0.0 },
  },
};

// ── Particle Class (mouse-interactive) ────────
class Particle {
  constructor(w, h, palette) {
    this.reset(w, h, palette);
    this.depth = 0.3 + Math.random() * 0.7; // parallax depth (0.3=far, 1=close)
  }
  reset(w, h, palette) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.baseX = this.x;
    this.baseY = this.y;
    this.size = Math.random() * 2 + 0.3;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = (Math.random() - 0.5) * 0.2 - 0.05;
    this.opacity = Math.random() * 0.4 + 0.05;
    this.opacityDir = (Math.random() - 0.5) * 0.005;
    this.color = palette[Math.floor(Math.random() * palette.length)];
    this.w = w; this.h = h;
  }
  update(mx, my) {
    // Base motion
    this.baseX += this.speedX;
    this.baseY += this.speedY;
    this.opacity += this.opacityDir;
    if (this.opacity <= 0.03 || this.opacity >= 0.45) this.opacityDir *= -1;

    // Mouse parallax — deeper particles move less
    const parallaxX = mx * 15 * this.depth;
    const parallaxY = my * 10 * this.depth;
    this.x = this.baseX + parallaxX;
    this.y = this.baseY + parallaxY;

    // Wrap
    if (this.baseX < -10) this.baseX = this.w + 10;
    if (this.baseX > this.w + 10) this.baseX = -10;
    if (this.baseY < -10) this.baseY = this.h + 10;
    if (this.baseY > this.h + 10) this.baseY = -10;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.opacity;
    ctx.fill();
    // Glow for larger particles
    if (this.size > 1.2) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity * 0.04;
      ctx.fill();
    }
  }
}

// ── Star Class ────────────────────────────────
class Star {
  constructor(w, h) {
    this.x = Math.random() * w;
    this.y = Math.random() * h * 0.55;
    this.size = Math.random() * 1.1 + 0.2;
    this.baseOpacity = Math.random() * 0.35 + 0.08;
    this.twinkleSpeed = 0.5 + Math.random() * 2;
    this.phase = Math.random() * Math.PI * 2;
    this.currentOpacity = 0;
  }
  update(time, visible) {
    const target = visible ? this.baseOpacity + Math.sin(time * this.twinkleSpeed + this.phase) * 0.12 : 0;
    this.currentOpacity += (target - this.currentOpacity) * 0.04;
  }
  draw(ctx) {
    if (this.currentOpacity < 0.01) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = '#ccddff';
    ctx.globalAlpha = this.currentOpacity;
    ctx.fill();
  }
}

// ── Init ──────────────────────────────────────
export function initEnvironment(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');

  resizeCanvas();
  createParticles();
  createStars();
  createEmergencyOverlay();

  // Mouse listener for interactive parallax
  window.addEventListener('mousemove', (e) => {
    envMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    envMouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  animate();
  window.addEventListener('resize', () => {
    resizeCanvas();
    createStars();
  });
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticles() {
  const palette = palettes[currentMode].particles;
  particles = [];
  // Reduced count for performance: 100 instead of 180
  for (let i = 0; i < 100; i++) {
    particles.push(new Particle(canvas.width, canvas.height, palette));
  }
}

function createStars() {
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push(new Star(canvas.width, canvas.height));
  }
}

function createEmergencyOverlay() {
  emergencyOverlay = document.getElementById('emergency-overlay');
  if (emergencyOverlay) return;
  emergencyOverlay = document.createElement('div');
  emergencyOverlay.id = 'emergency-overlay';
  emergencyOverlay.innerHTML = `<div class="em-vignette"></div><div class="em-border"></div>`;
  document.body.appendChild(emergencyOverlay);
}

// ── Animate ───────────────────────────────────
function animate() {
  animId = requestAnimationFrame(animate);
  const time = performance.now() * 0.001;

  // Smooth mouse for particles
  envSmooth.x += (envMouse.x - envSmooth.x) * 0.05;
  envSmooth.y += (envMouse.y - envSmooth.y) * 0.05;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Morning gradient sky ──
  skyGradientOpacity += (targetSkyOpacity - skyGradientOpacity) * 0.03;
  if (skyGradientOpacity > 0.01) {
    drawMorningSky(time);
  }

  // ── Stars ──
  const showStars = palettes[currentMode]?.stars ?? false;
  for (const star of stars) {
    star.update(time, showStars);
    star.draw(ctx);
  }

  // ── Particles (mouse-interactive) ──
  for (const p of particles) {
    p.update(envSmooth.x, envSmooth.y);
    p.draw(ctx);
  }
  ctx.globalAlpha = 1;
}

// ── Morning gradient sky ──────────────────────
function drawMorningSky(time) {
  const w = canvas.width, h = canvas.height;

  // Gradient: deep blue-black at top → warm gold/orange at bottom
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(8, 12, 30, 0)');
  grad.addColorStop(0.4, `rgba(25, 15, 10, ${skyGradientOpacity * 0.3})`);
  grad.addColorStop(0.7, `rgba(60, 30, 10, ${skyGradientOpacity * 0.15})`);
  grad.addColorStop(0.9, `rgba(120, 60, 20, ${skyGradientOpacity * 0.08})`);
  grad.addColorStop(1, `rgba(180, 90, 30, ${skyGradientOpacity * 0.05})`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Haze particles (soft warm circles drifting slowly)
  const hazeCount = 6;
  for (let i = 0; i < hazeCount; i++) {
    const hx = (Math.sin(time * 0.08 + i * 2.1) * 0.5 + 0.5) * w;
    const hy = h * 0.5 + Math.sin(time * 0.12 + i * 1.7) * h * 0.2;
    const hr = 80 + Math.sin(time * 0.15 + i) * 30;

    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 180, 80, ${skyGradientOpacity * 0.015})`;
    ctx.fill();
  }

  // Sun glow at horizon (right side)
  const sunX = w * 0.75;
  const sunY = h * 0.85;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 200);
  sunGrad.addColorStop(0, `rgba(255, 200, 100, ${skyGradientOpacity * 0.08})`);
  sunGrad.addColorStop(0.5, `rgba(255, 150, 50, ${skyGradientOpacity * 0.03})`);
  sunGrad.addColorStop(1, 'rgba(255, 100, 20, 0)');

  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, w, h);
}

// ── Set Mode ──────────────────────────────────
export function setMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;
  const p = palettes[mode];
  if (!p) return;

  // Sky gradient
  targetSkyOpacity = p.skyGradient ? 1 : 0;

  const scene = getScene();
  const lights = getLights();

  // Re-color particles
  particles.forEach((pt) => {
    pt.color = p.particles[Math.floor(Math.random() * p.particles.length)];
  });

  // Scene fog
  if (scene?.fog) {
    const fogColor = new THREE.Color(p.fog.color);
    gsap.to(scene.fog.color, { r: fogColor.r, g: fogColor.g, b: fogColor.b, duration: 1.8, ease: 'power2.inOut' });
    gsap.to(scene.fog, { density: p.fog.density, duration: 1.8, ease: 'power2.inOut' });
  }

  if (lights) {
    if (lights.ambient) {
      const ac = new THREE.Color(p.ambient.color);
      gsap.to(lights.ambient.color, { r: ac.r, g: ac.g, b: ac.b, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(lights.ambient, { intensity: p.ambient.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    if (lights.directional) {
      const dc = new THREE.Color(p.directional.color);
      gsap.to(lights.directional.color, { r: dc.r, g: dc.g, b: dc.b, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(lights.directional, { intensity: p.directional.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    if (lights.rimBlue) gsap.to(lights.rimBlue, { intensity: p.rimBlue.intensity, duration: 1.5, ease: 'power2.inOut' });
    if (lights.accentPurple) gsap.to(lights.accentPurple, { intensity: p.accentPurple.intensity, duration: 1.5, ease: 'power2.inOut' });
    if (lights.underGlow) {
      const uc = new THREE.Color(p.underGlow.color);
      gsap.to(lights.underGlow.color, { r: uc.r, g: uc.g, b: uc.b, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(lights.underGlow, { intensity: p.underGlow.intensity, duration: 1.5, ease: 'power2.inOut' });
    }
    if (lights.headlight) gsap.to(lights.headlight, { intensity: p.headlight.intensity, duration: 1.5, ease: 'power2.inOut' });
  }

  setModelEmissive(p.modelEmissive.color, p.modelEmissive.intensity, 1.5);

  document.body.classList.remove('day-mode', 'morning-mode', 'night-mode');
  document.body.classList.add(mode + '-mode');
}

// ── Emergency Mode ────────────────────────────
export function setEmergencyMode(active) {
  if (active === isEmergency) return;
  isEmergency = active;
  const lights = getLights();

  if (active) {
    document.body.classList.add('emergency-mode');
    if (emergencyOverlay) emergencyOverlay.classList.add('active');
    setRoadState('heavy');

    if (lights.underGlow) {
      gsap.to(lights.underGlow.color, { r: 1, g: 0.15, b: 0.15, duration: 0.8, ease: 'power2.out' });
      gsap.to(lights.underGlow, { intensity: 5, duration: 0.8, ease: 'power2.out' });
    }
    if (lights.rimBlue) {
      gsap.to(lights.rimBlue.color, { r: 1, g: 0.2, b: 0.2, duration: 0.8, ease: 'power2.out' });
      gsap.to(lights.rimBlue, { intensity: 6, duration: 0.8, ease: 'power2.out' });
    }
    setModelEmissive(0xff2222, 0.6, 0.8);

    const scene = getScene();
    if (scene?.fog) gsap.to(scene.fog, { density: 0.06, duration: 1.0, ease: 'power2.out' });

    particles.forEach((pt) => {
      pt.color = ['#ff3b3b', '#ff6644', '#ff2222', '#cc1111', '#ff4444'][Math.floor(Math.random() * 5)];
    });
  } else {
    document.body.classList.remove('emergency-mode');
    if (emergencyOverlay) emergencyOverlay.classList.remove('active');
    setRoadState('optimal');

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
    if (scene?.fog) gsap.to(scene.fog, { density: p.fog.density, duration: 1.2, ease: 'power2.out' });

    particles.forEach((pt) => {
      pt.color = p.particles[Math.floor(Math.random() * p.particles.length)];
    });
  }
}

export function getMode() { return currentMode; }
export function getIsEmergency() { return isEmergency; }

export function destroyEnvironment() {
  cancelAnimationFrame(animId);
  window.removeEventListener('resize', resizeCanvas);
}
