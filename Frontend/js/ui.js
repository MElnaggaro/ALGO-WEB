/**
 * ui.js
 * ─────────────────────────────────────────────
 * Dashboard: Egyptian city graph with IMPROVED
 * visualization — larger nodes, bezier curves,
 * proper normalization, bigger labels, halos.
 */

import * as THREE from 'three';
import { setMode, setEmergencyMode } from './environment.js';
import { setRoadState } from './three-scene.js';

// ══════════════════════════════════════════════
// EGYPTIAN CITY GRAPH — better-spaced coordinates
// ══════════════════════════════════════════════
const cityNodes = [
  { id: 'maadi',         label: 'Maadi',          x: 0.35, y: 0.82 },
  { id: 'nasr_city',     label: 'Nasr City',      x: 0.70, y: 0.38 },
  { id: 'heliopolis',    label: 'Heliopolis',      x: 0.82, y: 0.22 },
  { id: 'downtown',      label: 'Downtown',        x: 0.48, y: 0.50 },
  { id: 'giza',          label: 'Giza',            x: 0.12, y: 0.45 },
  { id: 'zamalek',       label: 'Zamalek',         x: 0.40, y: 0.35 },
  { id: 'mohandessin',   label: 'Mohandessin',     x: 0.25, y: 0.30 },
  { id: 'dokki',         label: 'Dokki',           x: 0.20, y: 0.55 },
  { id: 'new_cairo',     label: 'New Cairo',       x: 0.90, y: 0.55 },
  { id: 'october',       label: '6th October',     x: 0.08, y: 0.15 },
  { id: 'shoubra',       label: 'Shoubra',         x: 0.52, y: 0.12 },
  { id: 'ain_shams',     label: 'Ain Shams',       x: 0.65, y: 0.18 },
];

const cityEdges = [
  { from: 'downtown',    to: 'zamalek',      weight: 3,  morningPeak: 0.7, nightTraffic: 0.3 },
  { from: 'downtown',    to: 'nasr_city',     weight: 6,  morningPeak: 0.9, nightTraffic: 0.4 },
  { from: 'downtown',    to: 'maadi',         weight: 7,  morningPeak: 0.6, nightTraffic: 0.3 },
  { from: 'downtown',    to: 'dokki',         weight: 4,  morningPeak: 0.8, nightTraffic: 0.35 },
  { from: 'downtown',    to: 'shoubra',       weight: 5,  morningPeak: 0.85, nightTraffic: 0.4 },
  { from: 'zamalek',     to: 'mohandessin',   weight: 3,  morningPeak: 0.6, nightTraffic: 0.25 },
  { from: 'zamalek',     to: 'dokki',         weight: 4,  morningPeak: 0.5, nightTraffic: 0.2 },
  { from: 'mohandessin', to: 'giza',          weight: 5,  morningPeak: 0.7, nightTraffic: 0.3 },
  { from: 'mohandessin', to: 'october',       weight: 8,  morningPeak: 0.65, nightTraffic: 0.2 },
  { from: 'giza',        to: 'dokki',         weight: 3,  morningPeak: 0.6, nightTraffic: 0.25 },
  { from: 'giza',        to: 'maadi',         weight: 9,  morningPeak: 0.5, nightTraffic: 0.2 },
  { from: 'nasr_city',   to: 'heliopolis',    weight: 4,  morningPeak: 0.75, nightTraffic: 0.35 },
  { from: 'nasr_city',   to: 'ain_shams',     weight: 5,  morningPeak: 0.8, nightTraffic: 0.4 },
  { from: 'nasr_city',   to: 'new_cairo',     weight: 7,  morningPeak: 0.7, nightTraffic: 0.3 },
  { from: 'heliopolis',  to: 'ain_shams',     weight: 3,  morningPeak: 0.65, nightTraffic: 0.3 },
  { from: 'heliopolis',  to: 'shoubra',       weight: 6,  morningPeak: 0.85, nightTraffic: 0.45 },
  { from: 'heliopolis',  to: 'new_cairo',     weight: 5,  morningPeak: 0.55, nightTraffic: 0.2 },
  { from: 'shoubra',     to: 'ain_shams',     weight: 4,  morningPeak: 0.75, nightTraffic: 0.35 },
  { from: 'october',     to: 'giza',          weight: 10, morningPeak: 0.6, nightTraffic: 0.15 },
  { from: 'dokki',       to: 'maadi',         weight: 6,  morningPeak: 0.55, nightTraffic: 0.25 },
  { from: 'new_cairo',   to: 'maadi',         weight: 8,  morningPeak: 0.5, nightTraffic: 0.2 },
];

// ── State ─────────────────────────────────────
let mapCanvas, mapCtx;
let currentPath = [];
let pathAnimProgress = 0;
let pathAnimId = null;
let trafficParticles = [];
let routeFlowParticles = [];
let edgeCurves = new Map(); // Store THREE.CatmullRomCurve3 per edge
let hoveredNode = null;
let currentTimePeriod = 'morning';
let currentTrafficMode = 'normal';

// Padding for graph display
const PAD = 40;

// ── Init Dashboard ────────────────────────────
export function initDashboard() {
  mapCanvas = document.getElementById('map-canvas');
  if (!mapCanvas) return;

  mapCtx = mapCanvas.getContext('2d');
  resizeMap();
  populateSelectors();
  bindEvents();
  startMapLoop();
  generateCurves(); // Generate initial curves
  createTrafficParticles();
  updateEdgeTraffic();

  window.addEventListener('resize', () => {
    resizeMap();
    generateCurves(); // Re-generate curves on resize
  });
}

function resizeMap() {
  if (!mapCanvas) return;
  const container = mapCanvas.parentElement;
  mapCanvas.width = container.clientWidth - 48;
  mapCanvas.height = container.clientHeight - 48;
}

// ── Node position helpers (with padding) ──────
function nodeX(node, w) {
  return PAD + node.x * (w - PAD * 2);
}
function nodeY(node, h) {
  return PAD + node.y * (h - PAD * 2);
}

// ── Curve Generation — same logic for all ──────
function generateCurves() {
  if (!mapCanvas) return;
  const w = mapCanvas.width, h = mapCanvas.height;
  edgeCurves.clear();

  cityEdges.forEach((edge, index) => {
    const from = cityNodes.find((n) => n.id === edge.from);
    const to = cityNodes.find((n) => n.id === edge.to);
    if (!from || !to) return;

    const x1 = nodeX(from, w), y1 = nodeY(from, h);
    const x2 = nodeX(to, w), y2 = nodeY(to, h);

    // Compute control point (mid-point + offset)
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const offset = len * 0.15;
    const cpx = mx + (-dy / len) * offset;
    const cpy = my + (dx / len) * offset;

    // Use Three.js Catmull-Rom for consistent, smooth spline
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x1, y1, 0),
      new THREE.Vector3(cpx, cpy, 0),
      new THREE.Vector3(x2, y2, 0)
    ], false, 'catmullrom', 0.5);

    // Pre-calculate 100 points for ultra-fast and consistent rendering
    curve.points100 = curve.getPoints(100);

    // Store by unique ID (from_to)
    edgeCurves.set(`${edge.from}_${edge.to}`, curve);
  });
}

function populateSelectors() {
  const srcSelect = document.getElementById('source-select');
  const dstSelect = document.getElementById('dest-select');
  if (!srcSelect || !dstSelect) return;

  cityNodes.forEach((node) => {
    srcSelect.add(new Option(node.label, node.id));
    dstSelect.add(new Option(node.label, node.id));
  });
  srcSelect.value = 'maadi';
  dstSelect.value = 'heliopolis';
}

function bindEvents() {
  const calcBtn = document.getElementById('calc-route-btn');
  if (calcBtn) calcBtn.addEventListener('click', calculateRoute);

  const timeSelect = document.getElementById('time-select');
  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => {
      currentTimePeriod = e.target.value;
      if (e.target.value === 'morning') setMode('morning');
      else if (e.target.value === 'afternoon') setMode('day');
      else setMode('night');
      updateEdgeTraffic();
      createTrafficParticles();
    });
  }

  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      currentTrafficMode = e.target.value;
      const isEmergency = e.target.value === 'emergency';
      setEmergencyMode(isEmergency);
      if (!isEmergency) updateRoadFromTraffic();
    });
  }

  document.querySelectorAll('.mode-btn[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn[data-mode]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setMode(btn.dataset.mode);
    });
  });

  if (mapCanvas) {
    mapCanvas.addEventListener('mousemove', onMapMouseMove);
    mapCanvas.addEventListener('click', onMapClick);
  }
}

function onMapMouseMove(e) {
  const rect = mapCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const w = mapCanvas.width, h = mapCanvas.height;

  hoveredNode = null;
  for (const node of cityNodes) {
    const nx = nodeX(node, w);
    const ny = nodeY(node, h);
    if (Math.hypot(mx - nx, my - ny) < 28) {
      hoveredNode = node.id;
      mapCanvas.style.cursor = 'pointer';
      break;
    }
  }
  if (!hoveredNode) mapCanvas.style.cursor = 'default';
}

function onMapClick() {
  if (!hoveredNode) return;
  const srcSelect = document.getElementById('source-select');
  const dstSelect = document.getElementById('dest-select');
  if (!srcSelect.value || srcSelect.value === '' || (srcSelect.value && dstSelect.value)) {
    srcSelect.value = hoveredNode;
    dstSelect.value = '';
  } else {
    dstSelect.value = hoveredNode;
  }
}

function updateEdgeTraffic() {
  cityEdges.forEach((edge) => {
    if (currentTimePeriod === 'morning') edge.traffic = edge.morningPeak;
    else if (currentTimePeriod === 'night') edge.traffic = edge.nightTraffic;
    else edge.traffic = (edge.morningPeak + edge.nightTraffic) / 2;
  });
}

function updateRoadFromTraffic() {
  const avg = cityEdges.reduce((s, e) => s + (e.traffic || 0.3), 0) / cityEdges.length;
  if (avg > 0.65) setRoadState('heavy');
  else if (avg > 0.4) setRoadState('moderate');
  else setRoadState('optimal');
}

// ── Dijkstra ──────────────────────────────────
function dijkstra(sourceId, destId, mode) {
  const adj = {};
  cityNodes.forEach((n) => (adj[n.id] = []));

  cityEdges.forEach((e) => {
    let w = e.weight;
    if (mode === 'emergency') w *= 0.5;
    else w *= 1 + (e.traffic || 0.3);
    adj[e.from].push({ to: e.to, weight: w });
    adj[e.to].push({ to: e.from, weight: w });
  });

  const dist = {}, prev = {};
  const visited = new Set();
  cityNodes.forEach((n) => { dist[n.id] = Infinity; prev[n.id] = null; });
  dist[sourceId] = 0;

  while (true) {
    let u = null, minD = Infinity;
    for (const nid of Object.keys(dist)) {
      if (!visited.has(nid) && dist[nid] < minD) { minD = dist[nid]; u = nid; }
    }
    if (u === null || u === destId) break;
    visited.add(u);
    for (const edge of adj[u]) {
      const alt = dist[u] + edge.weight;
      if (alt < dist[edge.to]) { dist[edge.to] = alt; prev[edge.to] = u; }
    }
  }

  const path = [];
  let curr = destId;
  while (curr) { path.unshift(curr); curr = prev[curr]; }
  if (path[0] !== sourceId) return { path: [], distance: Infinity };
  return { path, distance: dist[destId] };
}

function calculateRoute() {
  const source = document.getElementById('source-select')?.value;
  const dest = document.getElementById('dest-select')?.value;
  const mode = document.getElementById('mode-select')?.value || 'normal';

  if (!source || !dest || source === dest) {
    showNotification('Please select different source and destination');
    return;
  }

  const result = dijkstra(source, dest, mode);
  if (result.path.length === 0) { showNotification('No route found'); return; }

  currentPath = result.path;
  currentTrafficMode = mode;
  displayResults(result, mode);
  animatePath();
  if (mode !== 'emergency') updateRoadFromTraffic();
}

function displayResults(result, mode) {
  const totalTime = Math.round(result.distance * 2.5);
  const distKm = (result.distance * 1.8).toFixed(1);
  const avgTraffic = result.path.length > 1 ? getPathTraffic(result.path) : 0;
  const trafficLevel = avgTraffic > 0.65 ? 'high' : avgTraffic > 0.4 ? 'medium' : 'low';
  const trafficLabels = { low: 'Low Traffic', medium: 'Moderate', high: 'Heavy' };

  const etaEl = document.getElementById('stat-eta');
  const distEl = document.getElementById('stat-distance');
  const stopsEl = document.getElementById('stat-stops');
  const trafficEl = document.getElementById('stat-traffic');
  const routeStepsEl = document.getElementById('route-steps');

  if (etaEl) animateValue(etaEl, 0, totalTime, 900, ' min');
  if (distEl) animateValue(distEl, 0, parseFloat(distKm), 900, ' km');
  if (stopsEl) stopsEl.textContent = (result.path.length - 2) + ' stops';

  if (trafficEl) {
    const bar = trafficEl.querySelector('.traffic-bar');
    const label = trafficEl.querySelector('.traffic-label');
    if (bar) bar.className = 'traffic-bar traffic-' + trafficLevel;
    if (label) label.textContent = trafficLabels[trafficLevel];
  }

  if (routeStepsEl) {
    routeStepsEl.innerHTML = '';
    result.path.forEach((nodeId, i) => {
      const node = cityNodes.find((n) => n.id === nodeId);
      const step = document.createElement('div');
      step.className = 'route-step';
      let dotClass = 'step-dot';
      if (i === 0) dotClass += ' start';
      else if (i === result.path.length - 1) dotClass += ' end';
      step.innerHTML = `<span class="${dotClass}"></span><span>${node ? node.label : nodeId}</span>`;
      routeStepsEl.appendChild(step);
      gsap.fromTo(step, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, delay: i * 0.12, ease: 'power3.out' });
    });
  }

  const modeBadge = document.getElementById('mode-badge');
  if (modeBadge) {
    modeBadge.textContent = mode === 'emergency' ? '🚨 EMERGENCY' : '🚗 NORMAL';
    modeBadge.style.color = mode === 'emergency' ? 'var(--accent)' : 'var(--primary)';
  }
}

function getPathTraffic(path) {
  let total = 0, count = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = cityEdges.find(e =>
      (e.from === path[i] && e.to === path[i + 1]) || (e.to === path[i] && e.from === path[i + 1])
    );
    if (edge) { total += edge.traffic || 0.3; count++; }
  }
  return count > 0 ? total / count : 0.3;
}

function animateValue(el, start, end, duration, suffix = '') {
  const startTime = performance.now();
  const isFloat = !Number.isInteger(end);
  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * eased;
    el.textContent = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function animatePath() {
  pathAnimProgress = 0;
  if (pathAnimId) cancelAnimationFrame(pathAnimId);
  function tick() {
    pathAnimProgress += 0.008;
    if (pathAnimProgress > 1) pathAnimProgress = 1;
    if (pathAnimProgress < 1) pathAnimId = requestAnimationFrame(tick);
  }
  pathAnimId = requestAnimationFrame(tick);

  // Create flowing route particles
  createRouteFlowParticles();
}

function createRouteFlowParticles() {
  routeFlowParticles = [];
  if (currentPath.length < 2) return;
  // Create 6 flowing dots at staggered positions
  for (let i = 0; i < 6; i++) {
    routeFlowParticles.push({
      progress: i / 6,
      speed: 0.003 + Math.random() * 0.001,
      size: 3 + Math.random() * 2,
      opacity: 0.6 + Math.random() * 0.4,
    });
  }
}

function createTrafficParticles() {
  trafficParticles = [];
  cityEdges.forEach((edge) => {
    const t = edge.traffic || 0.3;
    const count = Math.floor(t * 3) + 1;
    for (let i = 0; i < count; i++) {
      trafficParticles.push({
        edge,
        progress: Math.random(),
        speed: 0.001 + Math.random() * 0.002,
        reverse: Math.random() > 0.5,
      });
    }
  });
}

// ══════════════════════════════════════════════
// MAP RENDER — IMPROVED
// ══════════════════════════════════════════════
function startMapLoop() {
  function draw() {
    requestAnimationFrame(draw);
    if (!mapCtx || !mapCanvas.width) return;
    const w = mapCanvas.width, h = mapCanvas.height;

    mapCtx.clearRect(0, 0, w, h);
    drawGrid(w, h);
    drawEdges(w, h);
    drawTrafficParticles(w, h);
    drawPath(w, h);
    drawRouteFlow(w, h);
    drawNodes(w, h);
  }
  requestAnimationFrame(draw);
}

function drawGrid(w, h) {
  mapCtx.strokeStyle = 'rgba(0, 195, 255, 0.02)';
  mapCtx.lineWidth = 0.5;
  const spacing = 40;
  for (let x = 0; x < w; x += spacing) {
    mapCtx.beginPath(); mapCtx.moveTo(x, 0); mapCtx.lineTo(x, h); mapCtx.stroke();
  }
  for (let y = 0; y < h; y += spacing) {
    mapCtx.beginPath(); mapCtx.moveTo(0, y); mapCtx.lineTo(w, y); mapCtx.stroke();
  }
}

// ── EDGES — same smooth curves for background ──
function drawEdges(w, h) {
  cityEdges.forEach((edge) => {
    const curve = edgeCurves.get(`${edge.from}_${edge.to}`);
    if (!curve || !curve.points100) return;

    const points = curve.points100;
    const t = edge.traffic || 0.3;
    let r, g, b;
    if (t < 0.5) {
      r = Math.round(t * 2 * 255);
      g = Math.round(200 + (1 - t * 2) * 55);
      b = Math.round((1 - t * 2) * 136);
    } else {
      r = 255;
      g = Math.round((1 - (t - 0.5) * 2) * 200);
      b = 50;
    }

    // Outer glow
    mapCtx.beginPath();
    mapCtx.moveTo(points[0].x, points[0].y);
    points.forEach(p => mapCtx.lineTo(p.x, p.y));
    mapCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.06 + t * 0.06})`;
    mapCtx.lineWidth = 6 + t * 4;
    mapCtx.lineCap = 'round';
    mapCtx.stroke();

    // Main edge
    mapCtx.beginPath();
    mapCtx.moveTo(points[0].x, points[0].y);
    points.forEach(p => mapCtx.lineTo(p.x, p.y));
    mapCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.2 + t * 0.25})`;
    mapCtx.lineWidth = 1.5 + t * 2;
    mapCtx.lineCap = 'round';
    mapCtx.stroke();
  });
}

// ── PATH — same geometry as background edges ──
function drawPath(w, h) {
  if (currentPath.length < 2) return;

  const isEmergency = currentTrafficMode === 'emergency';
  const pathColor = isEmergency ? '#ff3b3b' : '#00c3ff';
  const glowColor = isEmergency ? 'rgba(255,59,59,' : 'rgba(0,195,255,';

  const totalSegments = currentPath.length - 1;
  const animSeg = pathAnimProgress * totalSegments;

  for (let i = 0; i < totalSegments; i++) {
    if (i > animSeg) break;

    const fromId = currentPath[i];
    const toId = currentPath[i + 1];
    
    // Bidirectional lookup
    let curve = edgeCurves.get(`${fromId}_${toId}`) || edgeCurves.get(`${toId}_${fromId}`);
    if (!curve || !curve.points100) continue;

    const isReverse = !edgeCurves.has(`${fromId}_${toId}`);
    const segT = Math.min(1, animSeg - i);
    const points = curve.points100;

    mapCtx.lineCap = 'round';
    mapCtx.lineJoin = 'round';

    // Draw the path using the curve's exact points
    const drawCurvePath = (glow, width) => {
      mapCtx.beginPath();
      const startP = isReverse ? points[points.length - 1] : points[0];
      mapCtx.moveTo(startP.x, startP.y);

      if (segT >= 1) {
        // Full segment
        if (isReverse) {
          for (let j = points.length - 2; j >= 0; j--) mapCtx.lineTo(points[j].x, points[j].y);
        } else {
          for (let j = 1; j < points.length; j++) mapCtx.lineTo(points[j].x, points[j].y);
        }
      } else {
        // Partial segment — use exact parameter interpolation for terminal vertex
        const endP = curve.getPoint(isReverse ? (1 - segT) : segT);
        const segmentSplit = Math.floor((points.length - 1) * segT);
        
        if (isReverse) {
          for (let j = 1; j <= segmentSplit; j++) {
            const idx = points.length - 1 - j;
            mapCtx.lineTo(points[idx].x, points[idx].y);
          }
        } else {
          for (let j = 1; j <= segmentSplit; j++) mapCtx.lineTo(points[j].x, points[j].y);
        }
        mapCtx.lineTo(endP.x, endP.y);
      }
      mapCtx.strokeStyle = glow;
      mapCtx.lineWidth = width;
      mapCtx.stroke();
    };

    drawCurvePath(glowColor + '0.06)', 22);
    drawCurvePath(glowColor + '0.2)', 8);
    drawCurvePath(pathColor, 3);
  }
}

// ── ROUTE FLOW — particles perfectly aligned with curves ──
function drawRouteFlow(w, h) {
  if (currentPath.length < 2 || pathAnimProgress < 1 || routeFlowParticles.length === 0) return;

  const isEmergency = currentTrafficMode === 'emergency';
  const dotColor = isEmergency ? '#ff3b3b' : '#00c3ff';
  const glowColor = isEmergency ? 'rgba(255,59,59,' : 'rgba(0,195,255,';

  const totalSegments = currentPath.length - 1;

  routeFlowParticles.forEach((fp) => {
    fp.progress += fp.speed;
    if (fp.progress > 1) fp.progress -= 1;

    const pathT = fp.progress * totalSegments;
    const seg = Math.floor(pathT);
    const segT = pathT - seg;

    if (seg >= totalSegments) return;

    const fromId = currentPath[seg];
    const toId = currentPath[seg + 1];

    // Follow the SAME curve geometry as the visual line
    let curve = edgeCurves.get(`${fromId}_${toId}`) || edgeCurves.get(`${toId}_${fromId}`);
    if (!curve) return;

    // Correct direction if curve was stored backwards
    const isReverse = !edgeCurves.has(`${fromId}_${toId}`);
    const realSegT = isReverse ? (1 - segT) : segT;
    
    const p = curve.getPoint(realSegT);
    const tangent = curve.getTangent(realSegT);

    // Dynamic scale for "glow"
    const pulse = 1 + Math.sin(performance.now() * 0.01 + fp.progress * 10) * 0.1;

    mapCtx.save();
    mapCtx.translate(p.x, p.y);
    
    // Rotate to match curve tangent (pointing forward)
    let angle = Math.atan2(tangent.y, tangent.x);
    if (isReverse) angle += Math.PI; // flip tangent if reversed
    mapCtx.rotate(angle);
    
    // Comet Tail (glow trail)
    const gradient = mapCtx.createLinearGradient(-fp.size * 6, 0, 0, 0);
    gradient.addColorStop(0, glowColor + '0)');
    gradient.addColorStop(1, glowColor + (fp.opacity * 0.4 * pulse).toFixed(3) + ')');
    
    mapCtx.beginPath();
    mapCtx.fillStyle = gradient;
    mapCtx.roundRect(-fp.size * 8 * pulse, -fp.size * 0.8, fp.size * 8 * pulse, fp.size * 1.6, fp.size);
    mapCtx.fill();

    // Core Particle
    mapCtx.beginPath();
    mapCtx.arc(0, 0, fp.size * pulse, 0, Math.PI * 2);
    mapCtx.fillStyle = dotColor;
    mapCtx.shadowColor = dotColor;
    mapCtx.shadowBlur = 15;
    mapCtx.globalAlpha = fp.opacity;
    mapCtx.fill();
    
    mapCtx.restore();
    mapCtx.shadowBlur = 0;
    mapCtx.globalAlpha = 1;
  });
}

// ── Traffic Particles ─────────────────────────
function drawTrafficParticles(w, h) {
  trafficParticles.forEach((tp) => {
    tp.progress += tp.speed * (tp.reverse ? -1 : 1);
    if (tp.progress > 1 || tp.progress < 0) {
      tp.reverse = !tp.reverse;
      tp.progress = Math.max(0, Math.min(1, tp.progress));
    }

    const fromId = tp.edge.from;
    const toId = tp.edge.to;
    const curve = edgeCurves.get(`${fromId}_${toId}`);
    if (!curve) return;

    // Correct direction interpolation along the curve
    const p = curve.getPoint(tp.progress);
    const x = p.x;
    const y = p.y;

    const t = tp.edge.traffic || 0.3;
    const color = t > 0.65
      ? `rgba(255, 80, 50, ${0.25 + tp.progress * 0.25})`
      : t > 0.4
        ? `rgba(255, 200, 50, ${0.25 + tp.progress * 0.25})`
        : `rgba(0, 255, 136, ${0.25 + tp.progress * 0.25})`;

    mapCtx.beginPath();
    mapCtx.arc(x, y, 2.2, 0, Math.PI * 2);
    mapCtx.fillStyle = color;
    mapCtx.fill();
  });
}

// ── NODES — bigger, with halos + labels ───────
function drawNodes(w, h) {
  cityNodes.forEach((node) => {
    const x = nodeX(node, w);
    const y = nodeY(node, h);
    const isActive = currentPath.includes(node.id);
    const isHovered = hoveredNode === node.id;
    const isStart = currentPath[0] === node.id;
    const isEnd = currentPath[currentPath.length - 1] === node.id;

    // Outer halo (always visible, subtle)
    mapCtx.beginPath();
    mapCtx.arc(x, y, 18, 0, Math.PI * 2);
    if (isStart) mapCtx.fillStyle = 'rgba(0, 255, 136, 0.06)';
    else if (isEnd) mapCtx.fillStyle = 'rgba(255, 59, 59, 0.06)';
    else if (isActive) mapCtx.fillStyle = 'rgba(0, 195, 255, 0.06)';
    else if (isHovered) mapCtx.fillStyle = 'rgba(122, 0, 255, 0.06)';
    else mapCtx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    mapCtx.fill();

    // Pulse ring for active/hovered
    if (isActive || isHovered) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.4;
      mapCtx.beginPath();
      mapCtx.arc(x, y, 22 + pulse * 4, 0, Math.PI * 2);
      mapCtx.strokeStyle = isStart ? `rgba(0, 255, 136, ${pulse * 0.15})`
        : isEnd ? `rgba(255, 59, 59, ${pulse * 0.15})`
        : `rgba(0, 195, 255, ${pulse * 0.15})`;
      mapCtx.lineWidth = 1.5;
      mapCtx.stroke();
    }

    // Node dot — BIGGER
    const radius = isHovered ? 8 : isActive ? 7 : 5.5;
    mapCtx.beginPath();
    mapCtx.arc(x, y, radius, 0, Math.PI * 2);

    if (isStart) {
      mapCtx.fillStyle = '#00ff88';
      mapCtx.shadowColor = '#00ff88'; mapCtx.shadowBlur = 22;
    } else if (isEnd) {
      mapCtx.fillStyle = '#ff3b3b';
      mapCtx.shadowColor = '#ff3b3b'; mapCtx.shadowBlur = 22;
    } else if (isActive) {
      mapCtx.fillStyle = '#00c3ff';
      mapCtx.shadowColor = '#00c3ff'; mapCtx.shadowBlur = 18;
    } else {
      mapCtx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      mapCtx.shadowBlur = 0;
    }
    mapCtx.fill();
    mapCtx.shadowBlur = 0;

    // Label — BIGGER, always visible, high contrast
    mapCtx.font = '600 10px "Orbitron", monospace';
    mapCtx.textAlign = 'center';
    mapCtx.fillStyle = isActive ? '#00c3ff'
      : isHovered ? '#ffffff'
      : 'rgba(224, 230, 240, 0.55)';
    mapCtx.fillText(node.label, x, y - 20);
  });
}

// ── Notification ──────────────────────────────
function showNotification(msg) {
  let notif = document.getElementById('notification');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'notification';
    notif.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
      padding: 14px 28px; border-radius: 12px; background: rgba(255,59,59,0.15);
      border: 1px solid rgba(255,59,59,0.3); color: #ff3b3b;
      font-family: 'Orbitron', monospace; font-size: 0.7rem;
      letter-spacing: 2px; text-transform: uppercase; z-index: 10000;
      backdrop-filter: blur(10px); opacity: 0;
    `;
    document.body.appendChild(notif);
  }
  notif.textContent = msg;
  gsap.fromTo(notif,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      onComplete: () => gsap.to(notif, { opacity: 0, y: -10, delay: 2.5, duration: 0.4 }) }
  );
}

// ══════════════════════════════════════════════
// DASHBOARD TRANSITIONS
// ══════════════════════════════════════════════
export function transitionToDashboard() {
  const intro = document.querySelector('.intro-sections');
  const dashboard = document.getElementById('dashboard');
  const threeCanvas = document.getElementById('three-canvas');
  if (!dashboard) return;

  const tl = gsap.timeline();
  tl.to(intro, { opacity: 0, y: -50, duration: 0.7, ease: 'power3.in', onComplete: () => intro.classList.add('hidden') });
  tl.to(threeCanvas, { opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4');
  tl.call(() => { dashboard.classList.add('active'); initDashboard(); });
  tl.to(dashboard, { opacity: 1, duration: 0.9, ease: 'power3.out' });
  tl.fromTo('.dash-header', { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.4');
  tl.fromTo('.dash-panel', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.15, ease: 'power3.out' }, '-=0.3');
  tl.fromTo('.map-container', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.5');
  return tl;
}

export function transitionToIntro() {
  const intro = document.querySelector('.intro-sections');
  const dashboard = document.getElementById('dashboard');
  const threeCanvas = document.getElementById('three-canvas');
  const tl = gsap.timeline();

  setEmergencyMode(false);
  tl.to(dashboard, { opacity: 0, duration: 0.6, ease: 'power3.in', onComplete: () => dashboard.classList.remove('active') });
  tl.call(() => intro.classList.remove('hidden'));
  tl.to(intro, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
  tl.to(threeCanvas, { opacity: 1, duration: 0.7, ease: 'power2.out' }, '-=0.5');
  return tl;
}
