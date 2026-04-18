/**
 * three-scene.js
 * ─────────────────────────────────────────────
 * Three.js scene with cinematic Batmobile.
 *
 * The scroll-system provides continuous lerp'd
 * values each frame. This file's animate() reads
 * those values and applies alive motion on top.
 *
 * Alive motion: sway, tilt, bob, idle rotation.
 * Road: dashed lines + light streaks + edge glow.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Module State ──────────────────────────────
let scene, camera, renderer;
let modelGroup = null;
let clock;
let lights = {};
let isReady = false;
let onLoadCallback = null;
let onProgressCallback = null;
let animationId = null;
let shadowPlane = null;

// ── Alive motion state (tweened via GSAP) ─────
const alive = {
  idleSpeed: 0.002,
  floatAmp: 0.002,   // micro-suspension amplitude
  floatSpeed: 2.0,   // micro-suspension frequency
  swayAmp: 0.15,     // left/right sway amplitude
  swaySpeed: 0.8,    // sway frequency
  tiltAmp: 0.03,     // z-rotation tilt
  tiltSpeed: 0.5,    // tilt frequency
  roadSpeed: 0.05,
  // These are accumulated by the scroll system
  baseX: 0, baseY: 0, baseZ: 1.5,
  baseRX: 0, baseRY: 0, baseRZ: 0,
  baseScale: 1.6,
};

// Road system
let roadGroup = null;
let roadLines = [];
let roadEdgeLeft = null;
let roadEdgeRight = null;
let lightStreaks = [];

// Star system
let starGroup = null;

// ── Init ──────────────────────────────────────
export function initScene(container, { onLoad, onProgress } = {}) {
  onLoadCallback = onLoad || null;
  onProgressCallback = onProgress || null;
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.035);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.2, 6);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.3));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false; // Performance: disable shadows as requested
  renderer.domElement.id = 'three-canvas';

  container.appendChild(renderer.domElement);

  setupLighting();
  setupRoad();
  setupStars();

  window.addEventListener('resize', onResize);
  animate();
}

// ── Lighting ──────────────────────────────────
function setupLighting() {
  lights.ambient = new THREE.AmbientLight(0x111122, 0.4);
  scene.add(lights.ambient);

  lights.directional = new THREE.DirectionalLight(0xeeeeff, 1.0);
  lights.directional.position.set(5, 10, 5);
  scene.add(lights.directional);

  lights.rimBlue = new THREE.PointLight(0x00c3ff, 4, 20);
  lights.rimBlue.position.set(4, 1.5, -2);
  scene.add(lights.rimBlue);

  lights.accentPurple = new THREE.PointLight(0x7a00ff, 2.5, 20);
  lights.accentPurple.position.set(-4, 2.5, -1);
  scene.add(lights.accentPurple);

  lights.underGlow = new THREE.PointLight(0x00c3ff, 1.0, 6);
  lights.underGlow.position.set(0, -0.5, 0);
  scene.add(lights.underGlow);

  lights.backFill = new THREE.PointLight(0x334466, 0.6, 25);
  lights.backFill.position.set(0, 4, -8);
  scene.add(lights.backFill);

  lights.headlight = new THREE.SpotLight(0xffeedd, 1.5, 30, Math.PI / 8, 0.5);
  lights.headlight.position.set(0, 0.8, 3);
  lights.headlight.target.position.set(0, 0, 20);
  scene.add(lights.headlight);
  scene.add(lights.headlight.target);
}

// ── Star background (subtle) ──────────────────
function setupStars() {
  starGroup = new THREE.Group();
  const starGeo = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 150; i++) {
    positions.push(
      (Math.random() - 0.5) * 80,
      Math.random() * 30 + 5,
      (Math.random() - 0.5) * 80 - 20
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0x8899cc,
    size: 0.08,
    transparent: true,
    opacity: 0.6,
  });
  const stars = new THREE.Points(starGeo, starMat);
  starGroup.add(stars);
  scene.add(starGroup);
}

// ── Road System ───────────────────────────────
function setupRoad() {
  roadGroup = new THREE.Group();
  scene.add(roadGroup);

  const ROAD_Y = 0; // RE-LEVELED Coordinate system

  // Main asphalt
  const roadGeo = new THREE.PlaneGeometry(6, 80);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a10, roughness: 0.7, metalness: 0.2,
    transparent: true, opacity: 0.85,
  });
  const roadPlane = new THREE.Mesh(roadGeo, roadMat);
  roadPlane.rotation.x = -Math.PI / 2;
  roadPlane.position.set(0, ROAD_Y, 0);
  roadGroup.add(roadPlane);

  // Center dashed lines
  for (let i = 0; i < 30; i++) {
    const dashGeo = new THREE.PlaneGeometry(0.08, 1.2);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0x00c3ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, ROAD_Y + 0.02, -40 + i * 2.8);
    roadGroup.add(dash);
    roadLines.push(dash);
  }

  // Neon edge lines
  const edgeGeo = new THREE.PlaneGeometry(0.05, 80);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: 0x00c3ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
  });
  roadEdgeLeft = new THREE.Mesh(edgeGeo, edgeMat.clone());
  roadEdgeLeft.rotation.x = -Math.PI / 2;
  roadEdgeLeft.position.set(-2.8, ROAD_Y + 0.02, 0);
  roadGroup.add(roadEdgeLeft);

  roadEdgeRight = new THREE.Mesh(edgeGeo, edgeMat.clone());
  roadEdgeRight.rotation.x = -Math.PI / 2;
  roadEdgeRight.position.set(2.8, ROAD_Y + 0.02, 0);
  roadGroup.add(roadEdgeRight);

  // Side glow strips
  const glowGeo = new THREE.PlaneGeometry(0.4, 80);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00c3ff, transparent: true, opacity: 0.05, side: THREE.DoubleSide,
  });
  [[-2.8], [2.8]].forEach(([x]) => {
    const g = new THREE.Mesh(glowGeo, glowMat.clone());
    g.rotation.x = -Math.PI / 2;
    g.position.set(x, ROAD_Y + 0.01, 0);
    roadGroup.add(g);
  });

  // Light streaks — fast-moving on road
  for (let i = 0; i < 8; i++) {
    const sLen = 1.5 + Math.random() * 3;
    const sGeo = new THREE.PlaneGeometry(0.025, sLen);
    const sMat = new THREE.MeshBasicMaterial({
      color: 0x00c3ff, transparent: true,
      opacity: 0.08 + Math.random() * 0.12, side: THREE.DoubleSide,
    });
    const streak = new THREE.Mesh(sGeo, sMat);
    streak.rotation.x = -Math.PI / 2;
    streak.position.set((Math.random() - 0.5) * 5, ROAD_Y + 0.03, -40 + Math.random() * 80);
    streak.userData.speed = 0.06 + Math.random() * 0.14;
    roadGroup.add(streak);
    lightStreaks.push(streak);
  }

  // Ground beyond road
  const groundGeo = new THREE.PlaneGeometry(60, 80);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x030308, roughness: 0.9, metalness: 0.1,
    transparent: true, opacity: 0.5,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = ROAD_Y - 0.01;
  roadGroup.add(ground);

  // Shadow under car
  const shadowGeo = new THREE.PlaneGeometry(3.5, 2.0);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
  });
  // shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  // shadowPlane.rotation.x = -Math.PI / 2;
  // shadowPlane.position.set(0, ROAD_Y + 0.03, 0);
  // scene.add(shadowPlane); (REMOVED: caused unrealistic dark halo)
}

// ── Model Loading ─────────────────────────────
function loadModel() {
  const loader = new GLTFLoader();
  let loadFinished = false;

  // Safety timeout: if it takes more than 15s, force "Ready" state
  const safetyTimeout = setTimeout(() => {
    if (!loadFinished) {
      console.warn('Loading taking too long, forcing ready state');
      finishLoading();
    }
  }, 15000);

  function finishLoading() {
    if (loadFinished) return;
    loadFinished = true;
    clearTimeout(safetyTimeout);
    isReady = true;
    if (onLoadCallback) onLoadCallback();
  }

  loader.load(
    'models/batmobile_jet_car_1989.glb',
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      console.log('Model Bounds:', box.min.y, box.max.y);

      // ALIGN BOTTOM TO GROUND:
      // Subtract min.y to move the lowest point of the model to Y=0
      model.position.y -= box.min.y;

      const scaleFactor = 2.2 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scaleFactor);

      model.traverse((child) => {
        if (child.isMesh) {
          if (child.material) {
            child.material.envMapIntensity = 1.6;
            child.userData.origEmissive = child.material.emissive?.clone() || new THREE.Color(0);
            child.userData.origEmissiveIntensity = child.material.emissiveIntensity || 0;
          }
        }
      });

      modelGroup = new THREE.Group();
      modelGroup.add(model);
      modelGroup.scale.setScalar(0.01);

      // Base height: grounded (0.01 offset for sub-pixel safety)
      // Since model.position.y was adjusted so its bottom is at 0
      alive.baseY = 0.01; 
      
      modelGroup.position.set(0, alive.baseY, 1.5);
      scene.add(modelGroup);

      finishLoading();
    },
    (xhr) => {
      if (onProgressCallback) {
        if (xhr.lengthComputable && xhr.total > 0) {
          onProgressCallback(Math.round((xhr.loaded / xhr.total) * 100));
        } else {
          // Fallback progress if Content-Length is missing (common with GZIP)
          // Just increment to 90% based on chunks
          const fallbackProgress = Math.min(90, Math.round((xhr.loaded / 11000000) * 100));
          onProgressCallback(fallbackProgress);
        }
      }
    },
    (error) => {
      console.error('Error loading model:', error);
      finishLoading();
    }
  );
}

// ── Animation Loop ────────────────────────────
function animate() {
  animationId = requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  if (modelGroup && modelGroup.scale.x > 0.05) {
    // ── Read scroll state and apply base position ──
    // The scroll system LERPs `alive.baseX/Y/Z` etc. 
    // We apply alive motion ON TOP of those.

    const sway = Math.sin(elapsed * alive.swaySpeed) * alive.swayAmp;
    const bob = Math.sin(elapsed * alive.floatSpeed) * alive.floatAmp;
    const tilt = Math.sin(elapsed * alive.tiltSpeed + 0.7) * alive.tiltAmp;

    // Apply position: scroll base + alive offsets
    modelGroup.position.x = alive.baseX + sway;
    modelGroup.position.y = alive.baseY + bob;
    modelGroup.position.z = alive.baseZ;

    // Apply rotation: scroll base + idle + tilt
    modelGroup.rotation.x = alive.baseRX;
    modelGroup.rotation.y = alive.baseRY + elapsed * alive.idleSpeed;
    modelGroup.rotation.z = alive.baseRZ + tilt;

    // Apply scale
    const s = alive.baseScale;
    modelGroup.scale.set(s, s, s);

    // Under-glow breathing
    lights.underGlow.intensity = 1.0 + Math.sin(elapsed * 1.5) * 0.3;
    lights.underGlow.position.set(alive.baseX, -0.5, alive.baseZ);

    // Headlight flicker
    lights.headlight.intensity = 1.5 + Math.sin(elapsed * 3) * 0.2;

    // Shadow follows car
    if (shadowPlane) {
      shadowPlane.position.x = alive.baseX + sway;
      shadowPlane.position.z = alive.baseZ;
    }
  }

  // Road lines — forward illusion
  for (const dash of roadLines) {
    dash.position.z += alive.roadSpeed;
    if (dash.position.z > 40) dash.position.z = -40;
  }

  // Light streaks
  for (const streak of lightStreaks) {
    streak.position.z += streak.userData.speed;
    if (streak.position.z > 40) {
      streak.position.z = -40;
      streak.position.x = (Math.random() - 0.5) * 5;
    }
  }

  // Stars drift
  if (starGroup) {
    starGroup.rotation.y += 0.0001;
  }

  renderer.render(scene, camera);
}

// ── Resize ────────────────────────────────────
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ═══════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════

export function getCamera() { return camera; }
export function getModelGroup() { return modelGroup; }
export function getLights() { return lights; }
export function getScene() { return scene; }
export function getAlive() { return alive; }
export function isSceneReady() { return isReady; }
// Exposing for lazy loading
export { loadModel };

// ── Scroll system writes to alive state ───────
export function setAliveMotion(sway, tilt) {
  gsap.to(alive, {
    swayAmp: sway.amplitude, swaySpeed: sway.speed,
    tiltAmp: tilt.amplitude, tiltSpeed: tilt.speed,
    duration: 1.5, ease: 'power2.out', overwrite: 'auto',
  });
}

export function setRoadSpeed(speed) {
  gsap.to(alive, {
    roadSpeed: speed,
    duration: 1.0, ease: 'power2.out', overwrite: 'auto',
  });
}

// ── Road color (traffic state) ────────────────
export function setRoadState(trafficLevel) {
  const colors = {
    optimal: { color: 0x00c3ff, opacity: 0.5, edgeOpacity: 0.6 },
    moderate: { color: 0xffaa00, opacity: 0.6, edgeOpacity: 0.7 },
    heavy: { color: 0xff3b3b, opacity: 0.7, edgeOpacity: 0.8 },
  };
  const cfg = colors[trafficLevel] || colors.optimal;
  const tc = new THREE.Color(cfg.color);

  roadLines.forEach((dash) => {
    gsap.to(dash.material.color, { r: tc.r, g: tc.g, b: tc.b, duration: 1.5, ease: 'power2.out' });
    gsap.to(dash.material, { opacity: cfg.opacity, duration: 1.5, ease: 'power2.out' });
  });
  [roadEdgeLeft, roadEdgeRight].forEach((edge) => {
    if (!edge) return;
    gsap.to(edge.material.color, { r: tc.r, g: tc.g, b: tc.b, duration: 1.5, ease: 'power2.out' });
    gsap.to(edge.material, { opacity: cfg.edgeOpacity, duration: 1.5, ease: 'power2.out' });
  });
}

// ── Model emissive ────────────────────────────
export function setModelEmissive(color, intensity, duration = 1.5) {
  if (!modelGroup) return;
  const tc = new THREE.Color(color);
  modelGroup.traverse((child) => {
    if (child.isMesh && child.material?.emissive) {
      gsap.to(child.material.emissive, { r: tc.r, g: tc.g, b: tc.b, duration, ease: 'power2.out' });
      gsap.to(child.material, { emissiveIntensity: intensity, duration, ease: 'power2.out' });
    }
  });
}

export function dispose() {
  window.removeEventListener('resize', onResize);
  cancelAnimationFrame(animationId);
  renderer.dispose();
}
