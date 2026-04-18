/**
 * ui.js
 * ─────────────────────────────────────────────
 * Dashboard: Egyptian city graph with real neighborhoods,
 * Dijkstra pathfinding, emergency mode integration,
 * traffic-aware visualization, animated route rendering.
 */

import { setMode, setEmergencyMode } from './environment.js';
import { setRoadState } from './three-scene.js';

// ══════════════════════════════════════════════
// EGYPTIAN CITY GRAPH — real neighborhoods
// ══════════════════════════════════════════════
const cityNodes = [
  { id: 'maadi',         label: 'Maadi',          x: 0.28, y: 0.72 },
  { id: 'nasr_city',     label: 'Nasr City',      x: 0.68, y: 0.30 },
  { id: 'heliopolis',    label: 'Heliopolis',      x: 0.78, y: 0.18 },
  { id: 'downtown',      label: 'Downtown',        x: 0.42, y: 0.42 },
  { id: 'giza',          label: 'Giza',            x: 0.15, y: 0.38 },
  { id: 'zamalek',       label: 'Zamalek',         x: 0.35, y: 0.30 },
  { id: 'mohandessin',   label: 'Mohandessin',     x: 0.22, y: 0.25 },
  { id: 'dokki',         label: 'Dokki',           x: 0.18, y: 0.48 },
  { id: 'new_cairo',     label: 'New Cairo',       x: 0.88, y: 0.45 },
  { id: 'october',       label: '6th October',     x: 0.08, y: 0.15 },
  { id: 'shoubra',       label: 'Shoubra',         x: 0.48, y: 0.14 },
  { id: 'ain_shams',     label: 'Ain Shams',       x: 0.60, y: 0.18 },
];

// Traffic data with morning/night peak values
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
let hoveredNode = null;
let currentTimePeriod = 'night';
let currentTrafficMode = 'normal'; // track for road state

// ── Init Dashboard ────────────────────────────
export function initDashboard() {
  mapCanvas = document.getElementById('map-canvas');
  if (!mapCanvas) return;

  mapCtx = mapCanvas.getContext('2d');
  resizeMap();
  populateSelectors();
  bindEvents();
  startMapLoop();
  createTrafficParticles();
  updateEdgeTraffic();

  window.addEventListener('resize', resizeMap);
}

// ── Resize Map ────────────────────────────────
function resizeMap() {
  if (!mapCanvas) return;
  const container = mapCanvas.parentElement;
  mapCanvas.width = container.clientWidth - 48;
  mapCanvas.height = container.clientHeight - 48;
}

// ── Populate Selectors ────────────────────────
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

// ── Bind Events ───────────────────────────────
function bindEvents() {
  const calcBtn = document.getElementById('calc-route-btn');
  if (calcBtn) calcBtn.addEventListener('click', calculateRoute);

  const timeSelect = document.getElementById('time-select');
  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => {
      currentTimePeriod = e.target.value;
      // Set environment mode
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
      if (!isEmergency) {
        // Restore road to traffic-appropriate state
        updateRoadFromTraffic();
      }
    });
  }

  // Day/night toggle buttons in header
  document.querySelectorAll('.mode-btn[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn[data-mode]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setMode(btn.dataset.mode);
    });
  });

  // Map interactions
  if (mapCanvas) {
    mapCanvas.addEventListener('mousemove', onMapMouseMove);
    mapCanvas.addEventListener('click', onMapClick);
  }
}

// ── Map Mouse ─────────────────────────────────
function onMapMouseMove(e) {
  const rect = mapCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  hoveredNode = null;
  for (const node of cityNodes) {
    const nx = node.x * mapCanvas.width;
    const ny = node.y * mapCanvas.height;
    if (Math.hypot(mx - nx, my - ny) < 22) {
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

// ── Update Edge Traffic Based on Time ─────────
function updateEdgeTraffic() {
  cityEdges.forEach((edge) => {
    if (currentTimePeriod === 'morning') {
      edge.traffic = edge.morningPeak;
    } else if (currentTimePeriod === 'night') {
      edge.traffic = edge.nightTraffic;
    } else {
      // afternoon — average
      edge.traffic = (edge.morningPeak + edge.nightTraffic) / 2;
    }
  });
}

// ── Update Road State from Average Traffic ────
function updateRoadFromTraffic() {
  const avgTraffic = cityEdges.reduce((s, e) => s + (e.traffic || 0.3), 0) / cityEdges.length;
  if (avgTraffic > 0.65) setRoadState('heavy');
  else if (avgTraffic > 0.4) setRoadState('moderate');
  else setRoadState('optimal');
}

// ── Dijkstra ──────────────────────────────────
function dijkstra(sourceId, destId, mode) {
  const adj = {};
  cityNodes.forEach((n) => (adj[n.id] = []));

  cityEdges.forEach((e) => {
    let w = e.weight;
    if (mode === 'emergency') {
      w *= 0.5; // Emergency: aggressive shortcuts
    } else {
      w *= 1 + (e.traffic || 0.3); // Traffic-weighted
    }
    adj[e.from].push({ to: e.to, weight: w });
    adj[e.to].push({ to: e.from, weight: w });
  });

  const dist = {};
  const prev = {};
  const visited = new Set();

  cityNodes.forEach((n) => {
    dist[n.id] = Infinity;
    prev[n.id] = null;
  });
  dist[sourceId] = 0;

  while (true) {
    let u = null;
    let minD = Infinity;
    for (const nid of Object.keys(dist)) {
      if (!visited.has(nid) && dist[nid] < minD) {
        minD = dist[nid];
        u = nid;
      }
    }
    if (u === null || u === destId) break;
    visited.add(u);

    for (const edge of adj[u]) {
      const alt = dist[u] + edge.weight;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = u;
      }
    }
  }

  const path = [];
  let curr = destId;
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  if (path[0] !== sourceId) return { path: [], distance: Infinity };
  return { path, distance: dist[destId] };
}

// ── Calculate Route ───────────────────────────
function calculateRoute() {
  const source = document.getElementById('source-select')?.value;
  const dest = document.getElementById('dest-select')?.value;
  const mode = document.getElementById('mode-select')?.value || 'normal';

  if (!source || !dest || source === dest) {
    showNotification('Please select different source and destination');
    return;
  }

  const result = dijkstra(source, dest, mode);

  if (result.path.length === 0) {
    showNotification('No route found');
    return;
  }

  currentPath = result.path;
  currentTrafficMode = mode;
  displayResults(result, mode);
  animatePath();

  // Update road visualization
  if (mode !== 'emergency') {
    updateRoadFromTraffic();
  }
}

// ── Display Results ───────────────────────────
function displayResults(result, mode) {
  const totalTime = Math.round(result.distance * 2.5);
  const distKm = (result.distance * 1.8).toFixed(1);
  const avgTraffic = result.path.length > 1
    ? getPathTraffic(result.path) : 0;
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

      step.innerHTML = `
        <span class="${dotClass}"></span>
        <span>${node ? node.label : nodeId}</span>
      `;
      routeStepsEl.appendChild(step);

      gsap.fromTo(step,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, delay: i * 0.12, ease: 'power3.out' }
      );
    });
  }

  const modeBadge = document.getElementById('mode-badge');
  if (modeBadge) {
    modeBadge.textContent = mode === 'emergency' ? '🚨 EMERGENCY' : '🚗 NORMAL';
    modeBadge.style.color = mode === 'emergency' ? 'var(--accent)' : 'var(--primary)';
  }
}

// Get average traffic for path edges
function getPathTraffic(path) {
  let total = 0, count = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = cityEdges.find(e =>
      (e.from === path[i] && e.to === path[i + 1]) ||
      (e.to === path[i] && e.from === path[i + 1])
    );
    if (edge) { total += edge.traffic || 0.3; count++; }
  }
  return count > 0 ? total / count : 0.3;
}

// ── Animate Value ─────────────────────────────
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

// ── Path Animation ────────────────────────────
function animatePath() {
  pathAnimProgress = 0;
  if (pathAnimId) cancelAnimationFrame(pathAnimId);

  function tick() {
    pathAnimProgress += 0.006;
    if (pathAnimProgress > 1) pathAnimProgress = 1;
    if (pathAnimProgress < 1) pathAnimId = requestAnimationFrame(tick);
  }
  pathAnimId = requestAnimationFrame(tick);
}

// ── Traffic Particles ─────────────────────────
function createTrafficParticles() {
  trafficParticles = [];
  cityEdges.forEach((edge) => {
    const t = edge.traffic || 0.3;
    const count = Math.floor(t * 5) + 1;
    for (let i = 0; i < count; i++) {
      trafficParticles.push({
        edge,
        progress: Math.random(),
        speed: 0.0008 + Math.random() * 0.002,
        reverse: Math.random() > 0.5,
      });
    }
  });
}

// ══════════════════════════════════════════════
// MAP RENDER LOOP
// ══════════════════════════════════════════════
function startMapLoop() {
  function draw() {
    requestAnimationFrame(draw);
    if (!mapCtx || !mapCanvas.width) return;

    const w = mapCanvas.width;
    const h = mapCanvas.height;

    mapCtx.clearRect(0, 0, w, h);
    drawGrid(w, h);
    drawEdges(w, h);
    drawPath(w, h);
    drawTrafficParticles(w, h);
    drawNodes(w, h);
  }
  requestAnimationFrame(draw);
}

// ── Draw Grid ─────────────────────────────────
function drawGrid(w, h) {
  mapCtx.strokeStyle = 'rgba(0, 195, 255, 0.025)';
  mapCtx.lineWidth = 0.5;

  const spacing = 35;
  for (let x = 0; x < w; x += spacing) {
    mapCtx.beginPath(); mapCtx.moveTo(x, 0); mapCtx.lineTo(x, h); mapCtx.stroke();
  }
  for (let y = 0; y < h; y += spacing) {
    mapCtx.beginPath(); mapCtx.moveTo(0, y); mapCtx.lineTo(w, y); mapCtx.stroke();
  }
}

// ── Draw Edges — traffic colored ──────────────
function drawEdges(w, h) {
  cityEdges.forEach((edge) => {
    const from = cityNodes.find((n) => n.id === edge.from);
    const to = cityNodes.find((n) => n.id === edge.to);
    if (!from || !to) return;

    const x1 = from.x * w, y1 = from.y * h;
    const x2 = to.x * w, y2 = to.y * h;

    const t = edge.traffic || 0.3;
    // Green → Yellow → Red
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

    const alpha = 0.15 + t * 0.2;
    mapCtx.beginPath();
    mapCtx.moveTo(x1, y1);
    mapCtx.lineTo(x2, y2);
    mapCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    mapCtx.lineWidth = 1.5 + t * 2.5;
    mapCtx.stroke();
  });
}

// ── Draw Path ─────────────────────────────────
function drawPath(w, h) {
  if (currentPath.length < 2) return;

  const isEmergency = currentTrafficMode === 'emergency';
  const pathColor = isEmergency ? '#ff3b3b' : '#00c3ff';
  const glowColor = isEmergency ? 'rgba(255,59,59,' : 'rgba(0,195,255,';

  const points = currentPath.map((id) => {
    const node = cityNodes.find((n) => n.id === id);
    return { x: node.x * w, y: node.y * h };
  });

  const totalSegments = points.length - 1;
  const animSeg = pathAnimProgress * totalSegments;

  for (let i = 0; i < totalSegments; i++) {
    if (i > animSeg) break;

    const segProgress = Math.min(1, animSeg - i);
    const x1 = points[i].x, y1 = points[i].y;
    const x2 = points[i].x + (points[i + 1].x - points[i].x) * segProgress;
    const y2 = points[i].y + (points[i + 1].y - points[i].y) * segProgress;

    // Outer glow
    mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2);
    mapCtx.strokeStyle = glowColor + '0.12)';
    mapCtx.lineWidth = 14; mapCtx.lineCap = 'round'; mapCtx.stroke();

    // Mid glow
    mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2);
    mapCtx.strokeStyle = glowColor + '0.35)';
    mapCtx.lineWidth = 5; mapCtx.lineCap = 'round'; mapCtx.stroke();

    // Core
    mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2);
    mapCtx.strokeStyle = pathColor;
    mapCtx.lineWidth = 2.5; mapCtx.lineCap = 'round'; mapCtx.stroke();
  }

  // Moving vehicle dot
  if (pathAnimProgress >= 1) {
    const t = (performance.now() / 2500) % 1;
    const seg = Math.floor(t * totalSegments);
    const segT = (t * totalSegments) - seg;

    if (seg < totalSegments) {
      const px = points[seg].x + (points[seg + 1].x - points[seg].x) * segT;
      const py = points[seg].y + (points[seg + 1].y - points[seg].y) * segT;

      // Trail
      mapCtx.beginPath();
      mapCtx.arc(px, py, 12, 0, Math.PI * 2);
      mapCtx.fillStyle = glowColor + '0.1)';
      mapCtx.fill();

      mapCtx.beginPath();
      mapCtx.arc(px, py, 5, 0, Math.PI * 2);
      mapCtx.fillStyle = pathColor;
      mapCtx.shadowColor = pathColor;
      mapCtx.shadowBlur = 15;
      mapCtx.fill();
      mapCtx.shadowBlur = 0;
    }
  }
}

// ── Draw Traffic Particles ────────────────────
function drawTrafficParticles(w, h) {
  trafficParticles.forEach((tp) => {
    tp.progress += tp.speed * (tp.reverse ? -1 : 1);
    if (tp.progress > 1 || tp.progress < 0) {
      tp.reverse = !tp.reverse;
      tp.progress = Math.max(0, Math.min(1, tp.progress));
    }

    const from = cityNodes.find((n) => n.id === tp.edge.from);
    const to = cityNodes.find((n) => n.id === tp.edge.to);
    if (!from || !to) return;

    const x = from.x * w + (to.x * w - from.x * w) * tp.progress;
    const y = from.y * h + (to.y * h - from.y * h) * tp.progress;

    const t = tp.edge.traffic || 0.3;
    const color = t > 0.65
      ? `rgba(255, 80, 50, ${0.3 + tp.progress * 0.3})`
      : t > 0.4
        ? `rgba(255, 200, 50, ${0.3 + tp.progress * 0.3})`
        : `rgba(0, 255, 136, ${0.3 + tp.progress * 0.3})`;

    mapCtx.beginPath();
    mapCtx.arc(x, y, 1.8, 0, Math.PI * 2);
    mapCtx.fillStyle = color;
    mapCtx.fill();
  });
}

// ── Draw Nodes ────────────────────────────────
function drawNodes(w, h) {
  cityNodes.forEach((node) => {
    const x = node.x * w;
    const y = node.y * h;
    const isActive = currentPath.includes(node.id);
    const isHovered = hoveredNode === node.id;
    const isStart = currentPath[0] === node.id;
    const isEnd = currentPath[currentPath.length - 1] === node.id;

    // Pulse ring for active nodes
    if (isActive || isHovered) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.003) * 0.3;
      mapCtx.beginPath();
      mapCtx.arc(x, y, 20, 0, Math.PI * 2);
      mapCtx.fillStyle = isStart
        ? `rgba(0, 255, 136, ${pulse * 0.08})`
        : isEnd
          ? `rgba(255, 59, 59, ${pulse * 0.08})`
          : isActive
            ? `rgba(0, 195, 255, ${pulse * 0.08})`
            : `rgba(122, 0, 255, 0.06)`;
      mapCtx.fill();

      mapCtx.beginPath();
      mapCtx.arc(x, y, 13, 0, Math.PI * 2);
      mapCtx.strokeStyle = isStart
        ? 'rgba(0, 255, 136, 0.3)'
        : isEnd
          ? 'rgba(255, 59, 59, 0.3)'
          : 'rgba(0, 195, 255, 0.3)';
      mapCtx.lineWidth = 1;
      mapCtx.stroke();
    }

    // Node dot
    mapCtx.beginPath();
    mapCtx.arc(x, y, isHovered ? 7 : isActive ? 6 : 4.5, 0, Math.PI * 2);

    if (isStart) {
      mapCtx.fillStyle = '#00ff88';
      mapCtx.shadowColor = '#00ff88'; mapCtx.shadowBlur = 18;
    } else if (isEnd) {
      mapCtx.fillStyle = '#ff3b3b';
      mapCtx.shadowColor = '#ff3b3b'; mapCtx.shadowBlur = 18;
    } else if (isActive) {
      mapCtx.fillStyle = '#00c3ff';
      mapCtx.shadowColor = '#00c3ff'; mapCtx.shadowBlur = 15;
    } else {
      mapCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      mapCtx.shadowBlur = 0;
    }

    mapCtx.fill();
    mapCtx.shadowBlur = 0;

    // Label
    mapCtx.font = '600 9px "Orbitron", monospace';
    mapCtx.textAlign = 'center';
    mapCtx.fillStyle = isActive ? '#00c3ff' : isHovered ? '#ffffff' : 'rgba(224, 230, 240, 0.45)';
    mapCtx.fillText(node.label, x, y - 16);
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
    {
      opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      onComplete: () => {
        gsap.to(notif, { opacity: 0, y: -10, delay: 2.5, duration: 0.4 });
      },
    }
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

  tl.to(intro, {
    opacity: 0, y: -50, duration: 0.7, ease: 'power3.in',
    onComplete: () => intro.classList.add('hidden'),
  });

  tl.to(threeCanvas, {
    opacity: 0, duration: 0.6, ease: 'power2.out',
  }, '-=0.4');

  tl.call(() => {
    dashboard.classList.add('active');
    initDashboard();
  });

  tl.to(dashboard, {
    opacity: 1, duration: 0.9, ease: 'power3.out',
  });

  tl.fromTo('.dash-header',
    { y: -40, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
    '-=0.4'
  );

  tl.fromTo('.dash-panel',
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, stagger: 0.15, ease: 'power3.out' },
    '-=0.3'
  );

  tl.fromTo('.map-container',
    { scale: 0.95, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.6, ease: 'power3.out' },
    '-=0.5'
  );

  return tl;
}

export function transitionToIntro() {
  const intro = document.querySelector('.intro-sections');
  const dashboard = document.getElementById('dashboard');
  const threeCanvas = document.getElementById('three-canvas');

  const tl = gsap.timeline();

  // Clean up emergency mode if active
  setEmergencyMode(false);

  tl.to(dashboard, {
    opacity: 0, duration: 0.6, ease: 'power3.in',
    onComplete: () => dashboard.classList.remove('active'),
  });

  tl.call(() => intro.classList.remove('hidden'));

  tl.to(intro, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
  tl.to(threeCanvas, { opacity: 1, duration: 0.7, ease: 'power2.out' }, '-=0.5');

  return tl;
}
