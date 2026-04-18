/**
 * three-scene.js
 * ─────────────────────────────────────────────
 * Three.js scene: cinematic Batmobile with
 * smooth GSAP interpolation, animated road,
 * and dramatic lighting rig.
 *
 * ALL movement uses GSAP / lerp — NEVER direct set.
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

// ── Smooth state (target / current interpolation) ──
const state = {
  idleRotationSpeed: 0.003,
  floatAmplitude: 0.12,
  floatSpeed: 0.7,
  modelBaseY: 0,
};

// Road system
let roadGroup = null;
let roadLines = [];
let roadEdgeLeft = null;
let roadEdgeRight = null;
let roadPlane = null;
let roadGlowColor = { r: 0, g: 0.76, b: 1 }; // neon blue default

// ── Init ──────────────────────────────────────
export function initScene(container, { onLoad, onProgress } = {}) {
  onLoadCallback = onLoad || null;
  onProgressCallback = onProgress || null;
  clock = new THREE.Clock();

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.04);

  // Camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.0, 6);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'three-canvas';

  container.appendChild(renderer.domElement);

  // Lighting
  setupLighting();

  // Road environment
  setupRoad();

  // Load model
  loadModel();

  // Resize
  window.addEventListener('resize', onResize);

  // Start render loop
  animate();
}

// ── Lighting ──────────────────────────────────
function setupLighting() {
  // Ambient — soft fill
  lights.ambient = new THREE.AmbientLight(0x111122, 0.4);
  scene.add(lights.ambient);

  // Directional — main key light
  lights.directional = new THREE.DirectionalLight(0xeeeeff, 1.0);
  lights.directional.position.set(5, 10, 5);
  lights.directional.castShadow = true;
  lights.directional.shadow.mapSize.width = 1024;
  lights.directional.shadow.mapSize.height = 1024;
  lights.directional.shadow.camera.near = 0.5;
  lights.directional.shadow.camera.far = 60;
  lights.directional.shadow.camera.left = -10;
  lights.directional.shadow.camera.right = 10;
  lights.directional.shadow.camera.top = 10;
  lights.directional.shadow.camera.bottom = -10;
  scene.add(lights.directional);

  // Rim light — neon blue from right
  lights.rimBlue = new THREE.PointLight(0x00c3ff, 4, 20);
  lights.rimBlue.position.set(4, 1.5, -2);
  scene.add(lights.rimBlue);

  // Accent — purple from left
  lights.accentPurple = new THREE.PointLight(0x7a00ff, 2.5, 20);
  lights.accentPurple.position.set(-4, 2.5, -1);
  scene.add(lights.accentPurple);

  // Under-car glow
  lights.underGlow = new THREE.PointLight(0x00c3ff, 2.5, 8);
  lights.underGlow.position.set(0, -0.2, 0);
  scene.add(lights.underGlow);

  // Back fill
  lights.backFill = new THREE.PointLight(0x334466, 0.6, 25);
  lights.backFill.position.set(0, 4, -8);
  scene.add(lights.backFill);

  // Headlight — forward facing warm
  lights.headlight = new THREE.SpotLight(0xffeedd, 1.5, 30, Math.PI / 8, 0.5);
  lights.headlight.position.set(0, 0.5, 3);
  lights.headlight.target.position.set(0, 0, 20);
  scene.add(lights.headlight);
  scene.add(lights.headlight.target);
}

// ── Road System ───────────────────────────────
function setupRoad() {
  roadGroup = new THREE.Group();
  scene.add(roadGroup);

  // Road plane — dark asphalt
  const roadGeo = new THREE.PlaneGeometry(6, 80);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a10,
    roughness: 0.7,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
  });
  roadPlane = new THREE.Mesh(roadGeo, roadMat);
  roadPlane.rotation.x = -Math.PI / 2;
  roadPlane.position.set(0, -0.81, 0);
  roadPlane.receiveShadow = true;
  roadGroup.add(roadPlane);

  // Center dashed lines (moving forward illusion)
  const dashCount = 30;
  for (let i = 0; i < dashCount; i++) {
    const dashGeo = new THREE.PlaneGeometry(0.08, 1.2);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0x00c3ff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, -0.79, -40 + i * 2.8);
    roadGroup.add(dash);
    roadLines.push(dash);
  }

  // Neon edge lines
  const edgeGeo = new THREE.PlaneGeometry(0.04, 80);
  const edgeLeftMat = new THREE.MeshBasicMaterial({
    color: 0x00c3ff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  roadEdgeLeft = new THREE.Mesh(edgeGeo, edgeLeftMat.clone());
  roadEdgeLeft.rotation.x = -Math.PI / 2;
  roadEdgeLeft.position.set(-2.8, -0.79, 0);
  roadGroup.add(roadEdgeLeft);

  roadEdgeRight = new THREE.Mesh(edgeGeo, edgeLeftMat.clone());
  roadEdgeRight.rotation.x = -Math.PI / 2;
  roadEdgeRight.position.set(2.8, -0.79, 0);
  roadGroup.add(roadEdgeRight);

  // Side glow strips
  const glowGeo = new THREE.PlaneGeometry(0.3, 80);
  const glowMatL = new THREE.MeshBasicMaterial({
    color: 0x00c3ff,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
  });
  const glowL = new THREE.Mesh(glowGeo, glowMatL);
  glowL.rotation.x = -Math.PI / 2;
  glowL.position.set(-2.8, -0.8, 0);
  roadGroup.add(glowL);

  const glowR = new THREE.Mesh(glowGeo, glowMatL.clone());
  glowR.rotation.x = -Math.PI / 2;
  glowR.position.set(2.8, -0.8, 0);
  roadGroup.add(glowR);

  // Ground beyond road
  const groundGeo = new THREE.PlaneGeometry(60, 80);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x030308,
    roughness: 0.9,
    metalness: 0.1,
    transparent: true,
    opacity: 0.5,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.82;
  ground.receiveShadow = true;
  roadGroup.add(ground);
}

// ── Model Loading ─────────────────────────────
function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    'models/batmobile_jet_car_1989.glb',
    (gltf) => {
      const model = gltf.scene;

      // Compute bounding box & center
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      model.position.sub(center);

      // Normalize scale
      const maxDim = Math.max(size.x, size.y, size.z);
      const desiredSize = 2.2;
      const scaleFactor = desiredSize / maxDim;
      model.scale.setScalar(scaleFactor);

      // Enable shadows + store emissive materials
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.envMapIntensity = 1.8;
            // Store original emissive for mode changes
            child.userData.origEmissive = child.material.emissive
              ? child.material.emissive.clone()
              : new THREE.Color(0x000000);
            child.userData.origEmissiveIntensity = child.material.emissiveIntensity || 0;
          }
        }
      });

      // Wrap in group — start BIG and close (cinematic entry)
      modelGroup = new THREE.Group();
      modelGroup.add(model);
      modelGroup.scale.setScalar(1.8);
      modelGroup.position.set(0, 0, 1.5);
      scene.add(modelGroup);

      isReady = true;
      if (onLoadCallback) onLoadCallback();
    },
    (xhr) => {
      if (xhr.lengthComputable && onProgressCallback) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        onProgressCallback(pct);
      }
    },
    (error) => {
      console.error('Error loading model:', error);
      isReady = true;
      if (onLoadCallback) onLoadCallback();
    }
  );
}

// ── Animation Loop ────────────────────────────
function animate() {
  animationId = requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();

  if (modelGroup) {
    // Smooth idle rotation (additive, very slow)
    modelGroup.rotation.y += state.idleRotationSpeed;

    // Floating bob — smooth sine wave
    const floatY = Math.sin(elapsed * state.floatSpeed) * state.floatAmplitude;
    modelGroup.position.y = state.modelBaseY + floatY;

    // Subtle breathing on under-glow
    lights.underGlow.intensity = 2.5 + Math.sin(elapsed * 1.5) * 0.8;

    // Headlight flicker
    lights.headlight.intensity = 1.5 + Math.sin(elapsed * 3) * 0.2;
  }

  // Animate road lines (moving forward illusion)
  for (const dash of roadLines) {
    dash.position.z += 0.06;
    if (dash.position.z > 40) {
      dash.position.z = -40;
    }
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
// PUBLIC API — ALL use GSAP for smooth transitions
// ═══════════════════════════════════════════════

export function getCamera() { return camera; }
export function getModelGroup() { return modelGroup; }
export function getLights() { return lights; }
export function getScene() { return scene; }
export function getRenderer() { return renderer; }
export function getRoadGroup() { return roadGroup; }
export function getRoadLines() { return roadLines; }
export function getRoadEdges() { return { left: roadEdgeLeft, right: roadEdgeRight }; }
export function isSceneReady() { return isReady; }

// Smooth idle rotation change
export function setIdleRotation(speed) {
  gsap.to(state, {
    idleRotationSpeed: speed,
    duration: 1.0,
    ease: 'power2.out',
    overwrite: true,
  });
}

// Smooth float parameters
export function setFloat(amplitude, speed) {
  gsap.to(state, {
    floatAmplitude: amplitude,
    floatSpeed: speed,
    duration: 1.2,
    ease: 'power2.out',
    overwrite: true,
  });
}

// Smooth model scale
export function setModelScale(scale, duration = 1.5) {
  if (!modelGroup) return;
  gsap.to(modelGroup.scale, {
    x: scale, y: scale, z: scale,
    duration,
    ease: 'power3.out',
    overwrite: true,
  });
}

// Smooth model position
export function setModelPosition(x, y, z, duration = 1.5) {
  if (!modelGroup) return;
  state.modelBaseY = y;
  gsap.to(modelGroup.position, {
    x, z,
    duration,
    ease: 'power3.out',
    overwrite: true,
  });
}

// Smooth model rotation
export function setModelRotation(x, y, z, duration = 1.6) {
  if (!modelGroup) return;
  gsap.to(modelGroup.rotation, {
    x, y, z,
    duration,
    ease: 'power3.out',
    overwrite: true,
  });
}

// Change road color (traffic state)
export function setRoadState(trafficLevel) {
  // trafficLevel: 'optimal' | 'moderate' | 'heavy'
  const colors = {
    optimal: { color: 0x00c3ff, opacity: 0.5, edgeOpacity: 0.6 },
    moderate: { color: 0xffaa00, opacity: 0.6, edgeOpacity: 0.7 },
    heavy: { color: 0xff3b3b, opacity: 0.7, edgeOpacity: 0.8 },
  };
  const cfg = colors[trafficLevel] || colors.optimal;
  const targetColor = new THREE.Color(cfg.color);

  // Animate line colors
  roadLines.forEach((dash) => {
    gsap.to(dash.material.color, {
      r: targetColor.r, g: targetColor.g, b: targetColor.b,
      duration: 1.5, ease: 'power2.out',
    });
    gsap.to(dash.material, {
      opacity: cfg.opacity,
      duration: 1.5, ease: 'power2.out',
    });
  });

  // Animate edge colors
  [roadEdgeLeft, roadEdgeRight].forEach((edge) => {
    if (!edge) return;
    gsap.to(edge.material.color, {
      r: targetColor.r, g: targetColor.g, b: targetColor.b,
      duration: 1.5, ease: 'power2.out',
    });
    gsap.to(edge.material, {
      opacity: cfg.edgeOpacity,
      duration: 1.5, ease: 'power2.out',
    });
  });
}

// Set emissive glow on model
export function setModelEmissive(color, intensity, duration = 1.5) {
  if (!modelGroup) return;
  const targetColor = new THREE.Color(color);
  modelGroup.traverse((child) => {
    if (child.isMesh && child.material && child.material.emissive) {
      gsap.to(child.material.emissive, {
        r: targetColor.r, g: targetColor.g, b: targetColor.b,
        duration, ease: 'power2.out',
      });
      gsap.to(child.material, {
        emissiveIntensity: intensity,
        duration, ease: 'power2.out',
      });
    }
  });
}

export function dispose() {
  window.removeEventListener('resize', onResize);
  cancelAnimationFrame(animationId);
  renderer.dispose();
}
