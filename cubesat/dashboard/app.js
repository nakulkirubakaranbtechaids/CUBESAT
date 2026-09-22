// ==========================================================================
// CUBESAT MISSION CONTROL - MASTER FLIGHT OPERATIONS CORE
// Built to NASA / SpaceX Telemetry Standards
// ==========================================================================

// Global state variables
let map, satMarker, gsMarker, gsLosCircle, trackPolyline;
let trackHistory = [];
let telemetryChart;
let cubeMesh, scene, camera, renderer;
let isDragging3D = false, prevMouseX = 0, prevMouseY = 0;
let camRotX = 0.45, camRotY = -0.75, camDist = 3.6;

// Smoothing variables for 3D attitude
let targetPitch = 0, targetRoll = 0, targetYaw = 0;
let currentPitch = 0, currentRoll = 0, currentYaw = 0;
let yawOffset = 0;

// Mission Start Epoch for MET Calculation
const missionStartEpoch = Date.now();

// Variometer / Altitude tracking
let lastAlt = 0, lastAltTime = Date.now();

// Chart point buffer
const MAX_CHART_POINTS = 35;
const MAX_TABLE_ROWS = 60;

// Audio & Simulation state
let audioCtx = null;
let isAudioEnabled = false;
let isSimMode = false;
let simInterval = null;
let isStreamPaused = false;
let currentViewMode = 'table'; // 'table' | 'raw'

// Theme state (Light Theme default)
let currentTheme = localStorage.getItem('cubesat_theme') || 'theme-light';

// Map Tile Layers
let activeMapLayer = null;
let mapLayers = {};

// Ground Station Fixed Baseline Coordinates
const GS_COORDS = { lat: 13.0827, lng: 80.2707, name: "GS-01 CHENNAI" };

// ==========================================================================
// 1. INITIALIZE ON DOM LOAD
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initThemeSystem();
  initClocks();
  initThreeJSAttitude();
  initLeafletMap();
  initTelemetryChart();
  initEventSourceStream();
  initUIControls();
  initWebAudio();
});

// ==========================================================================
// 2. THEME CONTROLLER (LIGHT / DARK)
// ==========================================================================
function initThemeSystem() {
  applyTheme(currentTheme);

  const btnToggle = document.getElementById('btn-theme-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'theme-light' ? 'theme-dark' : 'theme-light';
      localStorage.setItem('cubesat_theme', currentTheme);
      applyTheme(currentTheme);
    });
  }
}

function applyTheme(theme) {
  document.body.className = theme;
  const iconEl = document.getElementById('theme-btn-icon');
  const textEl = document.getElementById('theme-btn-text');

  if (theme === 'theme-light') {
    if (iconEl) iconEl.innerText = '☀️';
    if (textEl) textEl.innerText = 'LIGHT';
    if (renderer) renderer.setClearColor(0xeef2f6, 1);
  } else {
    if (iconEl) iconEl.innerText = '🌙';
    if (textEl) textEl.innerText = 'DARK';
    if (renderer) renderer.setClearColor(0x04060a, 1);
  }

  // Update Chart theme if initialized
  if (telemetryChart) {
    const isLight = theme === 'theme-light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)';
    const tickColor = isLight ? '#64748b' : '#94a3b8';

    telemetryChart.options.scales.x.grid.color = gridColor;
    telemetryChart.options.scales.x.ticks.color = tickColor;
    telemetryChart.options.scales.yAlt.grid.color = isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.06)';
    telemetryChart.update();
  }
}

// ==========================================================================
// 3. MISSION ELAPSED TIME (MET) & UTC CHRONOMETERS
// ==========================================================================
function initClocks() {
  const metEl = document.getElementById('met-clock');
  const metMsEl = document.getElementById('met-ms');
  const utcEl = document.getElementById('utc-clock');

  function update() {
    const now = new Date();
    
    // Universal Time Coordinated (UTC)
    if (utcEl) {
      utcEl.innerText = now.toUTCString().split(' ')[4];
    }

    // Mission Elapsed Time (MET) formatted as DD:HH:MM:SS
    if (metEl) {
      const elapsedMs = Date.now() - missionStartEpoch;
      const totalSec = Math.floor(elapsedMs / 1000);
      const days = String(Math.floor(totalSec / 86400)).padStart(2, '0');
      const hours = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
      const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const secs = String(totalSec % 60).padStart(2, '0');
      metEl.innerText = `${days}:${hours}:${mins}:${secs}`;
      
      if (metMsEl) {
        const ms = String(elapsedMs % 1000).padStart(3, '0');
        metMsEl.innerText = `.${ms}`;
      }
    }
  }

  setInterval(update, 50);
}

// ==========================================================================
// 4. PROCEDURAL TEXTURES & THREE.JS 1U CUBESAT ATTITUDE GIMBAL
// ==========================================================================

// Create procedural Photovoltaic Solar Panel Texture
function createSolarPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Dark Space Cobalt Solar Wafer Base
  ctx.fillStyle = '#0a1d37';
  ctx.fillRect(0, 0, 256, 256);

  // Solar Cells Grid
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 248, 248);

  // Anti-reflective fine grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 12; i < 256; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 4);
    ctx.lineTo(i, 252);
    ctx.stroke();
  }

  // Silver Busbars (interconnects)
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(60, 4, 4, 248);
  ctx.fillRect(190, 4, 4, 248);

  // Solder pads
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(58, 8, 8, 12);
  ctx.fillRect(188, 8, 8, 12);
  ctx.fillRect(58, 236, 8, 12);
  ctx.fillRect(188, 236, 8, 12);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Create procedural Gold Kapton Thermal Blanket Texture
function createKaptonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 128, Math.random() * 128);
    ctx.lineTo(Math.random() * 128, Math.random() * 128);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function initThreeJSAttitude() {
  const container = document.getElementById('threejs-attitude-canvas');
  if (!container) return;

  const width = container.clientWidth || 340;
  const height = container.clientHeight || 350;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
  updateCameraPos();

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  const isLight = currentTheme === 'theme-light';
  renderer.setClearColor(isLight ? 0xeef2f6 : 0x04060a, 1);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Precision Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);

  const sunLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
  sunLight.position.set(6, 12, 8);
  scene.add(sunLight);

  const earthAlbedo = new THREE.DirectionalLight(0x0284c7, 0.6);
  earthAlbedo.position.set(-6, -8, -6);
  scene.add(earthAlbedo);

  // Coordinate Grid Floor
  const gridHelper = new THREE.GridHelper(10, 20, 0x94a3b8, 0xcbd5e1);
  gridHelper.position.y = -1.8;
  scene.add(gridHelper);

  // Assemble 1U CubeSat 3D Model
  const cubesatGroup = new THREE.Group();
  const solarTex = createSolarPanelTexture();
  const kaptonTex = createKaptonTexture();

  // 1. Titanium Chassis
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e2638,
    metalness: 0.85,
    roughness: 0.25,
  });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), chassisMat);
  cubesatGroup.add(chassis);

  // 2. Body Solar Panels
  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    metalness: 0.5,
    roughness: 0.2,
  });

  const tbPanel = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.02, 1.16), solarMat);
  tbPanel.position.set(0, 0.605, 0);
  cubesatGroup.add(tbPanel);

  const btmPanel = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.02, 1.16), solarMat);
  btmPanel.position.set(0, -0.605, 0);
  cubesatGroup.add(btmPanel);

  // Kapton Thermal Insulation Wrap
  const kaptonMat = new THREE.MeshStandardMaterial({
    map: kaptonTex,
    metalness: 0.8,
    roughness: 0.3,
  });
  const foilWrap = new THREE.Mesh(new THREE.BoxGeometry(1.21, 0.8, 0.8), kaptonMat);
  cubesatGroup.add(foilWrap);

  // 3. Deployable Solar Wings
  const wingGeo = new THREE.BoxGeometry(1.1, 0.03, 0.9);
  
  const leftWing = new THREE.Mesh(wingGeo, solarMat);
  leftWing.position.set(-1.22, 0, 0);
  cubesatGroup.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, solarMat);
  rightWing.position.set(1.22, 0, 0);
  cubesatGroup.add(rightWing);

  // Wing Hinges
  const hingeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
  const leftHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), hingeMat);
  leftHinge.rotation.x = Math.PI / 2;
  leftHinge.position.set(-0.62, 0, 0);
  cubesatGroup.add(leftHinge);

  const rightHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), hingeMat);
  rightHinge.rotation.x = Math.PI / 2;
  rightHinge.position.set(0.62, 0, 0);
  cubesatGroup.add(rightHinge);

  // 4. UHF Monopole Communications Antenna
  const antMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95 });
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 8), antMat);
  antenna.position.set(0.48, 1.2, 0.48);
  cubesatGroup.add(antenna);

  // RF Emission Ring
  const ringGeo = new THREE.RingGeometry(0.08, 0.12, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const rfRing = new THREE.Mesh(ringGeo, ringMat);
  rfRing.rotation.x = Math.PI / 2;
  rfRing.position.set(0.48, 1.85, 0.48);
  cubesatGroup.add(rfRing);

  // 5. Optical Lens Aperture
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
    metalness: 0.9,
    roughness: 0.1,
  });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), lensMat);
  lens.position.set(0, 0, 0.62);
  lens.rotation.x = Math.PI / 2;
  cubesatGroup.add(lens);

  // 6. Coordinate Vector Axes
  const axes = new THREE.AxesHelper(1.6);
  cubesatGroup.add(axes);

  scene.add(cubesatGroup);
  cubeMesh = cubesatGroup;

  // Mouse Orbit Drag Controls
  container.addEventListener('mousedown', (e) => {
    isDragging3D = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isDragging3D = false; });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging3D) return;
    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;
    camRotY += deltaX * 0.01;
    camRotX = Math.max(-1.4, Math.min(1.4, camRotX + deltaY * 0.01));
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    updateCameraPos();
  });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    camDist = Math.max(2.0, Math.min(6.5, camDist + e.deltaY * 0.003));
    updateCameraPos();
  }, { passive: false });

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    currentPitch += (targetPitch - currentPitch) * 0.1;
    currentRoll += (targetRoll - currentRoll) * 0.1;
    currentYaw += ((targetYaw - yawOffset) - currentYaw) * 0.08;

    if (cubeMesh) {
      cubeMesh.rotation.x = currentPitch;
      cubeMesh.rotation.z = currentRoll;
      cubeMesh.rotation.y = currentYaw;
    }

    if (rfRing) {
      const s = 1.0 + Math.sin(Date.now() * 0.005) * 0.2;
      rfRing.scale.set(s, s, s);
    }

    renderer.render(scene, camera);
  }
  animate();

  // Resize Observer for dynamic 16:9 flexbox containers
  const resizeHandler = () => {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight || 200;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  };

  if (window.ResizeObserver) {
    new ResizeObserver(resizeHandler).observe(container);
  }
  window.addEventListener('resize', resizeHandler);
}

function updateCameraPos() {
  if (!camera) return;
  camera.position.x = camDist * Math.sin(camRotY) * Math.cos(camRotX);
  camera.position.y = camDist * Math.sin(camRotX);
  camera.position.z = camDist * Math.cos(camRotY) * Math.cos(camRotX);
  camera.lookAt(0, 0, 0);
}

// ==========================================================================
// 5. GOOGLE SATELLITE & HYBRID MAP (LEAFLET INTEGRATION)
// ==========================================================================
function initLeafletMap() {
  const mapContainer = document.getElementById('gps-map');
  if (!mapContainer) return;

  map = L.map('gps-map', {
    zoomControl: true,
    attributionControl: false,
  }).setView([GS_COORDS.lat, GS_COORDS.lng], 5);

  // Initialize Map Layers: Google Satellite, Google Hybrid, and Streets
  mapLayers.satellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  });

  mapLayers.hybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  });

  mapLayers.street = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  });

  // Default: Google High-Resolution Satellite Map
  activeMapLayer = mapLayers.satellite;
  activeMapLayer.addTo(map);

  // 1. Ground Station Marker & 5° Elevation LOS Coverage Circle
  const gsIcon = L.divIcon({
    className: 'gs-radar-beacon',
    html: `<div style="
      width: 10px;
      height: 10px;
      background: #059669;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 10px #059669;
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  gsMarker = L.marker([GS_COORDS.lat, GS_COORDS.lng], { icon: gsIcon }).addTo(map);
  gsMarker.bindPopup(`<b style="color:#000;">${GS_COORDS.name}</b><br><span style="color:#333;font-size:11px;">Primary UHF Telemetry Station</span>`);

  // 500km Line-of-Sight Coverage Footprint
  gsLosCircle = L.circle([GS_COORDS.lat, GS_COORDS.lng], {
    radius: 450000,
    color: '#059669',
    weight: 1.5,
    fillColor: '#059669',
    fillOpacity: 0.1,
    dashArray: '4, 6',
  }).addTo(map);

  // 2. Sub-Satellite Beacon
  const satIcon = L.divIcon({
    className: 'sat-radar-beacon',
    html: `<div style="
      width: 14px;
      height: 14px;
      background: #0284c7;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 12px #0284c7;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  satMarker = L.marker([GS_COORDS.lat, GS_COORDS.lng], { icon: satIcon }).addTo(map);
  satMarker.bindPopup("<b style='color:#000;'>CUBESAT-1</b><br><span style='color:#333;font-size:11px;'>Sub-Satellite Point</span>");

  // 4. Trajectory Track Polyline
  trackPolyline = L.polyline([], {
    color: '#0284c7',
    weight: 3,
    opacity: 0.95,
  }).addTo(map);

  // 5. Initialize World Coral Reefs Mapping System
  initCoralReefs();

  // Layer Switching Handlers
  setupMapLayerSwitchers();

  // Resize Observer for dynamic 16:9 layout
  if (window.ResizeObserver && mapContainer) {
    new ResizeObserver(() => {
      if (map) map.invalidateSize();
    }).observe(mapContainer);
  }
  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
  });
}

// ==========================================================================
// 5B. COMPREHENSIVE WORLD CORAL REEFS DATASET & MONITORING JURISDICTIONS
// ==========================================================================
const CORAL_REEFS = [
  // --- INDIA & BAY OF BENGAL & ARABIAN SEA ---
  { name: "Gulf of Mannar Marine Biosphere", region: "Tamil Nadu, India", lat: 9.1500, lng: 79.1167, authority: "Tamil Nadu Forest Dept & Gulf of Mannar Biosphere Trust (GOMBRT)", type: "Fringing / Island Patch Reefs", cover: "38.6%", temp: "29.1°C", dhw: "1.2 DHW", status: "Active Thermal Stress", health: "critical", spectral: "480nm Blue-Green / 680nm Chl-a" },
  { name: "Palk Bay Coral Reefs", region: "Mandapam / Rameswaram, India", lat: 9.2833, lng: 79.1333, authority: "Dept of Environment & Climate Change, Govt of Tamil Nadu", type: "Shallow Fringing Reef", cover: "32.4%", temp: "29.3°C", dhw: "1.4 DHW", status: "Critical Heat Alert", health: "critical", spectral: "RGB Water Penetration" },
  { name: "Kavaratti Atoll", region: "Lakshadweep, India", lat: 10.5667, lng: 72.6417, authority: "Lakshadweep Administration & Zoological Survey of India (ZSI)", type: "Oceanic Coral Atoll", cover: "42.1%", temp: "28.9°C", dhw: "0.8 DHW", status: "Nominal Ecosystem", health: "nominal", spectral: "Multispectral Bathymetry" },
  { name: "Agatti Island Reef & Lagoon", region: "Lakshadweep, India", lat: 10.8500, lng: 72.1833, authority: "Lakshadweep Dept of Environment and Forests", type: "Atoll Lagoon & Barrier", cover: "46.5%", temp: "28.8°C", dhw: "0.6 DHW", status: "Nominal Ecosystem", health: "nominal", spectral: "Benthic Habitat Map" },
  { name: "Bangaram & Tinnakara Atoll", region: "Lakshadweep, India", lat: 10.9333, lng: 72.2833, authority: "Lakshadweep UT Environmental Protection Unit", type: "Submerged Atoll Barrier", cover: "51.0%", temp: "28.7°C", dhw: "0.5 DHW", status: "Protected Sanctuary", health: "nominal", spectral: "Optical Reflectance Index" },
  { name: "Minicoy Atoll Reefs", region: "Southern Lakshadweep, India", lat: 8.2833, lng: 73.0500, authority: "UT Lakshadweep Wildlife Wing / CMFRI", type: "Deep Oceanic Atoll", cover: "39.8%", temp: "29.0°C", dhw: "0.9 DHW", status: "Active Monitoring", health: "nominal", spectral: "Thermal Radiometry" },
  { name: "Mahatma Gandhi Marine National Park", region: "Wandoor, South Andaman, India", lat: 11.5833, lng: 92.6000, authority: "Andaman & Nicobar Dept of Environment & Forests", type: "Labyrinth Island Reefs", cover: "48.2%", temp: "29.2°C", dhw: "0.7 DHW", status: "Protected National Park", health: "nominal", spectral: "High-Res Coral Canopy" },
  { name: "Havelock Island (Swaraj Dweep)", region: "Ritchie's Archipelago, Andaman", lat: 11.9800, lng: 92.9800, authority: "Andaman Forest Dept & Wildlife Institute of India (WII)", type: "Fringing Barrier Reef", cover: "45.8%", temp: "29.4°C", dhw: "1.0 DHW", status: "Primary Satellite Target", health: "nominal", spectral: "Bleaching Index Proxy" },
  { name: "Neil Island (Shaheed Dweep)", region: "Andaman Islands, India", lat: 11.8333, lng: 93.0500, authority: "Andaman & Nicobar Forest Ecology Cell", type: "Living Coral Fringing Reef", cover: "43.0%", temp: "29.3°C", dhw: "1.1 DHW", status: "Active Monitoring", health: "nominal", spectral: "SST Radiance" },
  { name: "Great Nicobar Biosphere Reserve", region: "Nicobar Islands, India", lat: 7.0000, lng: 93.8000, authority: "Ministry of Environment, Forest & Climate Change (MoEFCC)", type: "Pristine Tropical Reefs", cover: "58.4%", temp: "29.6°C", dhw: "0.4 DHW", status: "UNESCO Biosphere Reserve", health: "nominal", spectral: "Chlorophyll-a Bio-Flux" },
  { name: "Marine National Park Gulf of Kutch", region: "Jamnagar, Gujarat, India", lat: 22.4667, lng: 69.8333, authority: "Gujarat Forest Department & Gujarat Ecology Commission", type: "Intertidal Coral Reefs", cover: "26.5%", temp: "27.8°C", dhw: "1.5 DHW", status: "Severe Siltation & Heat Risk", health: "critical", spectral: "Sediment & Coral Index" },
  { name: "Netrani Island Coral Sanctuary", region: "Murudeshwar, Karnataka, India", lat: 14.0167, lng: 74.3333, authority: "Karnataka Forest Dept & Coastal Security Police", type: "Island Fringing Reef", cover: "34.0%", temp: "28.5°C", dhw: "0.7 DHW", status: "Protected Marine Site", health: "nominal", spectral: "Optical Radiance Flux" },
  { name: "Malvan Marine Sanctuary (Sindhudurg)", region: "Maharashtra, India", lat: 16.0500, lng: 73.4667, authority: "Maharashtra Forest Dept (Mangrove Cell)", type: "Rocky Fringing Coral Beds", cover: "22.8%", temp: "28.1°C", dhw: "0.8 DHW", status: "High Turbidity & Silt Stress", health: "critical", spectral: "Benthic Spectrometry" },
  { name: "Pigeon Island National Park", region: "Trincomalee, Sri Lanka", lat: 8.7167, lng: 81.2000, authority: "Department of Wildlife Conservation (DWC), Sri Lanka", type: "Live Coral Reef Reserve", cover: "41.5%", temp: "29.0°C", dhw: "1.1 DHW", status: "Marine National Park", health: "nominal", spectral: "Reef Health Scan" },
  { name: "Bar Reef Marine Sanctuary", region: "Kalpitiya, Sri Lanka", lat: 8.3833, lng: 79.7333, authority: "Sri Lanka Wildlife Conservation & NARA", type: "Extensive Offshore Barrier", cover: "35.2%", temp: "29.2°C", dhw: "1.3 DHW", status: "Active Bleaching Alert", health: "critical", spectral: "SST Differential" },

  // --- CORAL TRIANGLE & SOUTHEAST ASIA ---
  { name: "Raja Ampat (Misool & Dampier)", region: "West Papua, Indonesia", lat: -0.2333, lng: 130.5167, authority: "Raja Ampat MPA Management Authority & KKP Indonesia", type: "Epicenter of Marine Biodiversity", cover: "64.2%", temp: "28.8°C", dhw: "0.3 DHW", status: "Global Biodiversity Benchmark", health: "nominal", spectral: "Hyperspectral Coral Grid" },
  { name: "Komodo National Park Reefs", region: "Lesser Sunda, Indonesia", lat: -8.5500, lng: 119.4833, authority: "Balai Taman Nasional Komodo & Ministry of Forestry", type: "Current-Swept Fringing Reefs", cover: "57.8%", temp: "27.5°C", dhw: "0.2 DHW", status: "UNESCO World Heritage", health: "nominal", spectral: "High Upwelling Optical Index" },
  { name: "Wakatobi Marine National Park", region: "Southeast Sulawesi, Indonesia", lat: -5.3167, lng: 123.5833, authority: "Balai Taman Nasional Wakatobi", type: "Barrier & Oceanic Atolls", cover: "53.4%", temp: "28.6°C", dhw: "0.4 DHW", status: "UNESCO Biosphere Reserve", health: "nominal", spectral: "Coral Fluorescence Proxy" },
  { name: "Bunaken National Marine Park", region: "North Sulawesi, Indonesia", lat: 1.6167, lng: 124.7500, authority: "Bunaken National Park Management Advisory Board", type: "Vertical Coral Drop-Off Walls", cover: "49.0%", temp: "28.9°C", dhw: "0.5 DHW", status: "Marine Park Protected", health: "nominal", spectral: "Steep Wall Optical Penetration" },
  { name: "Derawan Islands & Maratua Atoll", region: "East Kalimantan, Indonesia", lat: 2.2833, lng: 118.2500, authority: "Berau District MPA Management Unit / KKP", type: "Oceanic Atoll & Barrier", cover: "50.5%", temp: "29.1°C", dhw: "0.6 DHW", status: "Marine Turtle Sanctuary", health: "nominal", spectral: "Lagoon Thermal Balance" },
  { name: "Sipadan Island Marine Park", region: "Celebes Sea, Sabah, Malaysia", lat: 4.1167, lng: 118.6333, authority: "Sabah Parks Authority (Taman-Taman Sabah)", type: "Oceanic Seamount Barrier", cover: "62.0%", temp: "29.2°C", dhw: "0.3 DHW", status: "Strict Oceanic Sanctuary", health: "nominal", spectral: "Deep Water Spectral Index" },
  { name: "Tun Sakaran Marine Park", region: "Semporna, Sabah, Malaysia", lat: 4.6000, lng: 118.7500, authority: "Sabah Parks & Marine Conservation Society", type: "Extinct Volcanic Coral Caldera", cover: "47.3%", temp: "29.0°C", dhw: "0.5 DHW", status: "Nominal Ecosystem", health: "nominal", spectral: "Volcanic Mineral Reflectance" },
  { name: "Tubbataha Reefs Natural Park", region: "Sulu Sea, Palawan, Philippines", lat: 8.9167, lng: 119.9167, authority: "Tubbataha Management Office (TMO) & PCSD", type: "Pristine Double Atoll System", cover: "58.7%", temp: "29.2°C", dhw: "0.2 DHW", status: "UNESCO World Heritage Site", health: "nominal", spectral: "Pure Oceanic Coral Benchmark" },
  { name: "Apo Reef Natural Park", region: "Mindoro Strait, Philippines", lat: 12.6667, lng: 120.4833, authority: "Department of Environment and Natural Resources (DENR)", type: "Largest Contiguous Atoll in PH", cover: "49.5%", temp: "29.0°C", dhw: "0.7 DHW", status: "Protected Natural Park", health: "nominal", spectral: "Benthic Coral Ratio" },
  { name: "Palawan Coral Triangle (El Nido)", region: "Northern Palawan, Philippines", lat: 11.2000, lng: 119.4167, authority: "El Nido-Taytay Managed Resource Protected Area", type: "Karst Limestone Reefs", cover: "44.0%", temp: "29.3°C", dhw: "0.8 DHW", status: "Active Conservation Area", health: "nominal", spectral: "Nearshore Thermal Scan" },

  // --- AUSTRALIA & PACIFIC OCEAN ---
  { name: "Great Barrier Reef (Northern Sector)", region: "Raine Island / Cape York, Australia", lat: -11.5900, lng: 144.0300, authority: "Great Barrier Reef Marine Park Authority (GBRMPA)", type: "Remote Northern Barrier", cover: "34.2%", temp: "28.1°C", dhw: "0.9 DHW", status: "Active Remote Sensing", health: "nominal", spectral: "NOAA Bleaching Alert Matrix" },
  { name: "Great Barrier Reef (Central / Cairns)", region: "Cairns / Townsville, Australia", lat: -16.8500, lng: 146.3000, authority: "GBRMPA & Australian Institute of Marine Science (AIMS)", type: "Ribbon & Outer Barrier", cover: "28.5%", temp: "27.4°C", dhw: "1.2 DHW", status: "Bleaching Watch / Thermal Anomaly", health: "critical", spectral: "Multispectral Coral Cover" },
  { name: "Great Barrier Reef (Swain Reefs)", region: "Southern Sector, Queensland", lat: -21.8000, lng: 152.5000, authority: "GBRMPA & Queensland Parks and Wildlife Service", type: "Complex Oceanic Cays", cover: "31.0%", temp: "25.9°C", dhw: "0.6 DHW", status: "Nominal Ecosystem", health: "nominal", spectral: "SST & Chlorophyll Composite" },
  { name: "Ningaloo Coast Marine Park", region: "Exmouth, Western Australia", lat: -22.5000, lng: 113.8000, authority: "WA Dept of Biodiversity, Conservation and Attractions (DBCA)", type: "World's Largest Fringing Reef", cover: "35.5%", temp: "25.2°C", dhw: "0.3 DHW", status: "UNESCO World Heritage Site", health: "nominal", spectral: "High Arid Radiance Index" },
  { name: "Rowley Shoals Marine Park", region: "Timor Sea, Western Australia", lat: -17.3000, lng: 119.3500, authority: "Parks Australia & WA Parks and Wildlife Service", type: "Oceanic Shelf Atolls", cover: "48.0%", temp: "27.8°C", dhw: "0.4 DHW", status: "Pristine Marine Sanctuary", health: "nominal", spectral: "Clear Water Atoll Bathymetry" },
  { name: "Lord Howe Island Marine Park", region: "Tasman Sea, Australia", lat: -31.5500, lng: 159.0833, authority: "NSW Dept of Primary Industries & Parks Australia", type: "World's Southernmost Coral Reef", cover: "25.0%", temp: "21.8°C", dhw: "0.2 DHW", status: "Subtropical Sentinel Reef", health: "nominal", spectral: "Cold Water Adaptation Scan" },
  { name: "New Caledonia Great Barrier Reef", region: "South Pacific Ocean", lat: -20.9043, lng: 165.6180, authority: "Government of New Caledonia & Natural Park of the Coral Sea", type: "Second Longest Barrier in World", cover: "41.0%", temp: "25.8°C", dhw: "0.5 DHW", status: "UNESCO World Heritage", health: "nominal", spectral: "Lagoon Sediment & Bio-Cover" },
  { name: "Palau Rock Islands Southern Lagoon", region: "Koror State, Micronesia", lat: 7.3500, lng: 134.4667, authority: "Koror State Dept of Conservation & Palau PAN", type: "Marine Lakes & Outer Barrier", cover: "56.0%", temp: "29.5°C", dhw: "0.4 DHW", status: "Thermal Super-Resilient Reef", health: "nominal", spectral: "Heat Resilience Spectral Band" },
  { name: "Great Sea Reef (Cakaulevu)", region: "Vanua Levu, Fiji", lat: -16.5000, lng: 179.0000, authority: "Fiji Ministry of Fisheries & WWF South Pacific", type: "Continuous Outer Barrier Reef", cover: "46.2%", temp: "27.9°C", dhw: "0.7 DHW", status: "Customary Qoliqoli Protected", health: "nominal", spectral: "Benthic Ecosystem Index" },
  { name: "Papahānaumokuākea (Midway & Kure)", region: "Northwestern Hawaiian Islands, USA", lat: 25.0000, lng: -170.0000, authority: "NOAA, US Fish & Wildlife Service & State of Hawaii", type: "Largest Marine Conservation Area", cover: "37.8%", temp: "24.5°C", dhw: "0.3 DHW", status: "Strict Federal Monument", health: "nominal", spectral: "Oceanic Baseline Reflectance" },
  { name: "Moorea & Tahiti Coral Lagoons", region: "Society Islands, French Polynesia", lat: -17.5333, lng: -149.8333, authority: "Direction de l'Environnement de la Polynésie Française (DIREN)", type: "Barrier Reef & Volcanic Lagoon", cover: "39.0%", temp: "27.8°C", dhw: "0.6 DHW", status: "CRIOBE Long-Term Research", health: "nominal", spectral: "Longitudinal Growth Index" },
  { name: "Marovo Lagoon Reefs", region: "New Georgia, Solomon Islands", lat: -8.4833, lng: 158.1500, authority: "Ministry of Environment, Climate Change and Disaster Management", type: "World's Largest Saltwater Lagoon", cover: "52.3%", temp: "29.4°C", dhw: "0.5 DHW", status: "Community Marine Protected", health: "nominal", spectral: "Mangrove-Coral Interface Scan" },

  // --- RED SEA, GULF & MIDDLE EAST ---
  { name: "Ras Mohammed National Park", region: "Sinai Peninsula, Egypt", lat: 27.7333, lng: 34.2500, authority: "Egyptian Environmental Affairs Agency (EEAA) Nature Sector", type: "High-Salinity Thermal Reefs", cover: "52.0%", temp: "26.5°C", dhw: "0.2 DHW", status: "High Heat Resilience Sanctuary", health: "nominal", spectral: "Salinity & Thermal Tolerance" },
  { name: "Giftun Islands Marine Reserve", region: "Hurghada, Red Sea, Egypt", lat: 27.2333, lng: 33.9500, authority: "Red Sea Protected Areas Authority (HEPCA)", type: "Fringing & Patch Coral Reefs", cover: "44.6%", temp: "26.8°C", dhw: "0.4 DHW", status: "Active Marine Protected Area", health: "nominal", spectral: "Tourism Impact & Bio-Flux" },
  { name: "Farasan Islands Marine Sanctuary", region: "Southern Red Sea, Saudi Arabia", lat: 16.7000, lng: 42.1167, authority: "Saudi National Center for Wildlife (NCW)", type: "Protected Island Archipelago", cover: "48.1%", temp: "30.5°C", dhw: "1.4 DHW", status: "Extreme Heat Stress Anomaly", health: "critical", spectral: "Extreme SST Resilient Band" },
  { name: "Al Wajh Lagoon Coral Banks", region: "Red Sea Global Project, Saudi Arabia", lat: 25.6000, lng: 36.9000, authority: "Red Sea Development Company & NCW", type: "Pristine Undisturbed Atolls", cover: "55.8%", temp: "28.2°C", dhw: "0.3 DHW", status: "Special Conservation Zone", health: "nominal", spectral: "Conservation Bio-Baseline" },
  { name: "Daymaniyat Islands Nature Reserve", region: "Gulf of Oman, Oman", lat: 23.8500, lng: 58.0833, authority: "Environment Authority of the Sultanate of Oman", type: "Subtropical Rocky Fringing Reef", cover: "36.5%", temp: "27.9°C", dhw: "0.5 DHW", status: "UNESCO Tentative Site", health: "nominal", spectral: "Upwelling Bio-Diversity Scan" },

  // --- WESTERN INDIAN OCEAN & AFRICA ---
  { name: "Aldabra Atoll Marine Sanctuary", region: "Outer Islands, Seychelles", lat: -9.4167, lng: 46.3333, authority: "Seychelles Islands Foundation (SIF)", type: "World's 2nd Largest Coral Atoll", cover: "54.1%", temp: "27.6°C", dhw: "0.2 DHW", status: "UNESCO Strict Reserve", health: "nominal", spectral: "Isolated Oceanic Index" },
  { name: "Baa Atoll Biosphere Reserve", region: "Maldives Central Archipelago", lat: 5.1333, lng: 73.0500, authority: "Maldives Environmental Protection Agency (EPA)", type: "Manta Ray & Coral Atoll", cover: "36.4%", temp: "29.0°C", dhw: "0.8 DHW", status: "UNESCO World Biosphere", health: "nominal", spectral: "Hanifaru Bay Eco-Sensor" },
  { name: "Ari Atoll Marine Protected Area", region: "Maldives", lat: 3.8667, lng: 72.8333, authority: "Ministry of Climate Change, Environment & Energy, Maldives", type: "Circular Oceanic Coral Rings", cover: "34.0%", temp: "29.1°C", dhw: "0.9 DHW", status: "Active Conservation", health: "nominal", spectral: "Lagoon Surface Radiance" },
  { name: "Chagos Archipelago (Diego Garcia)", region: "British Indian Ocean Territory", lat: -6.0000, lng: 71.5000, authority: "BIOT Administration & Chagos Conservation Trust", type: "World's Cleanest Oceanic Waters", cover: "61.3%", temp: "28.5°C", dhw: "0.1 DHW", status: "Pristine Global Baseline", health: "nominal", spectral: "Zero Anthropogenic Reference" },
  { name: "Sainte Anne Marine National Park", region: "Mahé, Seychelles", lat: -4.6167, lng: 55.5000, authority: "Seychelles Parks and Gardens Authority (SPGA)", type: "Granitic Island Coral Reefs", cover: "31.2%", temp: "28.7°C", dhw: "0.8 DHW", status: "Marine National Park", health: "nominal", spectral: "Granite Substrate Scan" },
  { name: "Blue Bay Marine Park", region: "Grand Port, Mauritius", lat: -20.4500, lng: 57.7167, authority: "Ministry of Blue Economy & Marine Resources, Mauritius", type: "Dense Foliose Brain Corals", cover: "38.2%", temp: "26.4°C", dhw: "0.5 DHW", status: "Ramsar Wetland Protected", health: "nominal", spectral: "Endemic Coral Cover Index" },
  { name: "Mafia Island Marine Park", region: "Pwani, Tanzania", lat: -7.8500, lng: 39.8000, authority: "Tanzania Marine Parks & Reserves Unit (MPRU)", type: "Extensive Estuarine Barrier", cover: "39.8%", temp: "28.2°C", dhw: "0.6 DHW", status: "Multi-Use Marine Park", health: "nominal", spectral: "Estuarine-Coral Boundary Scan" },
  { name: "Kisite-Mpunguti Marine National Park", region: "Shimoni, Kwale County, Kenya", lat: -4.7167, lng: 39.3833, authority: "Kenya Wildlife Service (KWS)", type: "Enchanted Coral Garden", cover: "42.5%", temp: "28.4°C", dhw: "0.7 DHW", status: "National Park Protected", health: "nominal", spectral: "KWS Ecological Sensor" },

  // --- CARIBBEAN, ATLANTIC & EAST PACIFIC ---
  { name: "Belize Barrier Reef Reserve System", region: "Belize, Central America", lat: 17.3167, lng: -87.5333, authority: "Belize Fisheries Dept & Coastal Zone Authority (CZMAI)", type: "2nd Largest Barrier Reef in World", cover: "32.0%", temp: "28.2°C", dhw: "1.0 DHW", status: "UNESCO World Heritage Site", health: "nominal", spectral: "Blue Hole Bathymetry" },
  { name: "Arrecifes de Cozumel National Park", region: "Quintana Roo, Mexico", lat: 20.3500, lng: -86.9667, authority: "Comisión Nacional de Áreas Naturales Protegidas (CONANP)", type: "Mesoamerican Deep Wall Reefs", cover: "29.4%", temp: "28.5°C", dhw: "1.3 DHW", status: "Thermal Stress Watch", health: "critical", spectral: "Drift Wall Spectrometry" },
  { name: "Roatán Marine Park", region: "Bay Islands, Honduras", lat: 16.3333, lng: -86.5333, authority: "Roatan Marine Park (RMP) & ICF Honduras", type: "Spur & Groove Barrier System", cover: "36.2%", temp: "28.4°C", dhw: "0.9 DHW", status: "Community Marine Sanctuary", health: "nominal", spectral: "Spur-Groove Bio-Density" },
  { name: "Florida Keys National Marine Sanctuary", region: "Key Largo to Key West, USA", lat: 24.6280, lng: -81.1438, authority: "NOAA Office of National Marine Sanctuaries & Florida FWC", type: "Continental Barrier Reef Tract", cover: "14.2%", temp: "29.8°C", dhw: "3.2 DHW", status: "Bleaching Alert Level 2 (Critical)", health: "critical", spectral: "NOAA Coral Reef Watch DHW" },
  { name: "Flower Garden Banks Sanctuary", region: "Northwest Gulf of Mexico, USA", lat: 27.9167, lng: -93.6000, authority: "NOAA National Marine Sanctuaries", type: "Deep Salt Dome Coral Caps", cover: "52.0%", temp: "27.2°C", dhw: "0.4 DHW", status: "Deep Water High Coral Density", health: "nominal", spectral: "Offshore Dome Radiance" },
  { name: "Andros Barrier Reef & Exuma Cays", region: "Bahamas, Atlantic", lat: 24.7000, lng: -77.8000, authority: "Bahamas National Trust (BNT)", type: "Deep Oceanic Tongue of Ocean", cover: "29.0%", temp: "28.1°C", dhw: "0.8 DHW", status: "National Park Protected", health: "nominal", spectral: "Tongue of Ocean Trench Scan" },
  { name: "Bonaire National Marine Park", region: "Dutch Caribbean", lat: 12.1500, lng: -68.2833, authority: "STINAPA Bonaire National Parks Foundation", type: "Protected Fringing Coral Ecosystem", cover: "48.0%", temp: "28.4°C", dhw: "0.6 DHW", status: "Pioneer Marine Sanctuary", health: "nominal", spectral: "Shoreline Bio-Integrity Scan" },
  { name: "Soufrière Marine Management Area", region: "St. Lucia, Eastern Caribbean", lat: 13.8500, lng: -61.0667, authority: "Soufrière Marine Management Association (SMMA)", type: "Volcanic Piton Coral Drop-Offs", cover: "35.0%", temp: "28.6°C", dhw: "0.9 DHW", status: "Marine Management Reserve", health: "nominal", spectral: "Volcanic Substrate Spectral" },
  { name: "Galapagos Marine Reserve Coral Beds", region: "Galapagos Islands, Ecuador", lat: -0.9538, lng: -90.9656, authority: "Galapagos National Park Directorate (GNPD)", type: "Cold Upwelling Coral Communities", cover: "22.4%", temp: "22.1°C", dhw: "0.1 DHW", status: "El Niño Thermal Monitoring", health: "critical", spectral: "Upwelling Thermal Dynamics" },
  { name: "Cocos Island National Park", region: "Eastern Tropical Pacific, Costa Rica", lat: 5.5333, lng: -87.0667, authority: "National System of Conservation Areas (SINAC)", type: "Oceanic Seamount Corals", cover: "33.8%", temp: "26.5°C", dhw: "0.3 DHW", status: "Strict Biological Reserve", health: "nominal", spectral: "Pelagic-Benthic Interaction" },
  { name: "Fernando de Noronha & Atol das Rocas", region: "Atlantic, Brazil", lat: -3.8500, lng: -32.4167, authority: "ICMBio (Chico Mendes Institute for Biodiversity)", type: "Only South Atlantic Coral Atoll", cover: "44.2%", temp: "27.3°C", dhw: "0.2 DHW", status: "World Heritage Marine Park", health: "nominal", spectral: "South Atlantic Bio-Sentinel" }
];

let coralReefsLayerGroup = null;
let isReefsVisible = true;
let activeAlertReefIndex = 0;
let currentDistressIndex = 0;

function initCoralReefs() {
  coralReefsLayerGroup = L.layerGroup();

  const selectEl = document.getElementById('reef-select');

  // Count critical / poor health reefs
  const criticalCount = CORAL_REEFS.filter(r => r.health === 'critical').length;
  const alertHudText = document.getElementById('alert-hud-text');
  if (alertHudText) {
    alertHudText.innerText = `${criticalCount} HEALTH ALERTS`;
  }

  CORAL_REEFS.forEach((reef, index) => {
    // 1. Create custom reef marker based on health condition
    const isCritical = reef.health === 'critical';
    const coralIcon = L.divIcon({
      className: 'coral-reef-marker',
      html: `
        <div class="coral-pin-core ${isCritical ? 'critical' : ''}"></div>
        <div class="coral-pin-pulse ${isCritical ? 'critical' : ''}"></div>
      `,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    const marker = L.marker([reef.lat, reef.lng], { icon: coralIcon });
    
    const popupHtml = `
      <div class="coral-popup-card">
        <div class="coral-popup-title">
          <span>🪸 ${reef.name}</span>
          <span class="coral-health-badge ${isCritical ? 'critical' : 'nominal'}">
            ${isCritical ? '🚨 POOR / DISTRESSED' : '✅ NOMINAL / STABLE'}
          </span>
        </div>
        <div class="coral-popup-region">${reef.region}</div>
        
        <div class="coral-authority-box">
          <span class="coral-auth-lbl">🏛️ LOCAL MONITORING AUTHORITY / JURISDICTION</span>
          <span class="coral-auth-val">${reef.authority}</span>
        </div>

        <div class="coral-popup-grid">
          <div class="coral-popup-item">
            <span class="coral-popup-lbl">REEF TYPE</span>
            <span class="coral-popup-val">${reef.type}</span>
          </div>
          <div class="coral-popup-item">
            <span class="coral-popup-lbl">LIVE COVER</span>
            <span class="coral-popup-val ${isCritical ? 'text-rose' : 'text-emerald'}">${reef.cover}</span>
          </div>
          <div class="coral-popup-item">
            <span class="coral-popup-lbl">SEA SURFACE TEMP</span>
            <span class="coral-popup-val text-cyan">${reef.temp}</span>
          </div>
          <div class="coral-popup-item">
            <span class="coral-popup-lbl">HEAT STRESS (DHW)</span>
            <span class="coral-popup-val ${isCritical ? 'text-rose' : 'text-amber'}">${reef.dhw}</span>
          </div>
          <div class="coral-popup-item" style="grid-column: span 2;">
            <span class="coral-popup-lbl">SCAN STATUS / DIAGNOSIS</span>
            <span class="coral-popup-val ${isCritical ? 'text-rose' : 'text-emerald'}">${reef.status}</span>
          </div>
          <div class="coral-popup-item" style="grid-column: span 2;">
            <span class="coral-popup-lbl">SPECTRAL RADIOMETRY BAND</span>
            <span class="coral-popup-val text-purple" style="font-size: 0.52rem;">${reef.spectral}</span>
          </div>
        </div>

        <div class="coral-popup-actions">
          <button class="coral-alert-btn" style="${!isCritical ? 'background:#059669;box-shadow:0 2px 8px rgba(5,150,105,0.3);' : ''}" onclick="openAuthorityModal(${index})">
            ${isCritical ? '🚨 PUSH ECOLOGICAL ALERT TO LOCAL AUTHORITY' : '📢 TRANSMIT ADVISORY DISPATCH'}
          </button>
          <button class="coral-target-btn" onclick="targetReefScan(${index})">🛰️ TARGET REMOTE SENSING SCAN</button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml, {
      maxWidth: 320,
      minWidth: 250,
      autoPan: true,
      autoPanPadding: [20, 20],
      offset: [0, -6]
    });
    coralReefsLayerGroup.addLayer(marker);

    // 2. Populate Dropdown Option with alert icons
    if (selectEl) {
      const opt = document.createElement('option');
      opt.value = index;
      opt.innerText = `${isCritical ? '🚨' : '🪸'} ${reef.name} • ${reef.region.split(',')[0].trim()}${isCritical ? ' [POOR]' : ''}`;
      selectEl.appendChild(opt);
    }
  });

  coralReefsLayerGroup.addTo(map);

  // Dropdown Change Listener
  if (selectEl) {
    selectEl.addEventListener('change', (e) => {
      const idx = e.target.value;
      if (idx !== "") {
        targetReefScan(Number(idx));
      }
    });
  }

  // Toggle Reefs Button Listener
  const btnToggleReefs = document.getElementById('btn-toggle-reefs');
  if (btnToggleReefs) {
    btnToggleReefs.addEventListener('click', () => {
      isReefsVisible = !isReefsVisible;
      if (isReefsVisible) {
        map.addLayer(coralReefsLayerGroup);
        btnToggleReefs.classList.add('active-reef-btn');
        btnToggleReefs.innerText = '🪸 REEFS: ON';
      } else {
        map.removeLayer(coralReefsLayerGroup);
        btnToggleReefs.classList.remove('active-reef-btn');
        btnToggleReefs.innerText = '🪸 REEFS: OFF';
      }
    });
  }

  // Health Alerts HUD Button Listener
  const btnHealthAlerts = document.getElementById('btn-health-alerts');
  if (btnHealthAlerts) {
    btnHealthAlerts.addEventListener('click', () => {
      const distressedReefs = CORAL_REEFS.map((r, i) => ({ ...r, index: i })).filter(r => r.health === 'critical');
      if (distressedReefs.length === 0) return;

      const target = distressedReefs[currentDistressIndex % distressedReefs.length];
      currentDistressIndex++;
      
      targetReefScan(target.index);
      openAuthorityModal(target.index);
    });
  }
}

// ==========================================================================
// 5C. EMERGENCY AUTHORITY DISPATCH NOTIFICATION ENGINE
// ==========================================================================
window.openAuthorityModal = function(index) {
  const reef = CORAL_REEFS[index];
  if (!reef) return;

  activeAlertReefIndex = index;
  const modal = document.getElementById('authority-alert-modal');
  if (!modal) return;

  const authName = document.getElementById('modal-auth-name');
  const authRegion = document.getElementById('modal-auth-region');
  const reefName = document.getElementById('modal-reef-name');
  const reefStatus = document.getElementById('modal-reef-status');
  const reefTemp = document.getElementById('modal-reef-temp');
  const reefDhw = document.getElementById('modal-reef-dhw');
  const reefCover = document.getElementById('modal-reef-cover');
  const reefSpectral = document.getElementById('modal-reef-spectral');
  const dispatchStatus = document.getElementById('modal-dispatch-status');
  const btnConfirm = document.getElementById('btn-confirm-dispatch');

  if (authName) authName.innerText = reef.authority;
  if (authRegion) authRegion.innerText = `${reef.region} [Coordinates: ${reef.lat.toFixed(4)}°N, ${reef.lng.toFixed(4)}°E]`;
  if (reefName) reefName.innerText = reef.name;
  
  const isCritical = reef.health === 'critical';
  if (reefStatus) {
    reefStatus.innerText = reef.status;
    reefStatus.className = `anomaly-val ${isCritical ? 'text-rose' : 'text-emerald'}`;
  }
  if (reefTemp) reefTemp.innerText = `${reef.temp} (Surface Radiance Anomaly)`;
  if (reefDhw) reefDhw.innerText = `${reef.dhw} (${isCritical ? 'Urgent Warning' : 'Nominal Baseline'})`;
  if (reefCover) {
    reefCover.innerText = `${reef.cover} (${isCritical ? 'Degraded / Threatened' : 'Healthy Canopy'})`;
    reefCover.className = `anomaly-val ${isCritical ? 'text-rose' : 'text-emerald'}`;
  }
  if (reefSpectral) reefSpectral.innerText = reef.spectral;

  if (dispatchStatus) {
    dispatchStatus.innerText = 'READY FOR DOWNLINK TRANSMISSION TO LOCAL AGENCY...';
    dispatchStatus.className = 'proto-val text-amber';
  }

  if (btnConfirm) {
    btnConfirm.classList.remove('dispatched');
    btnConfirm.innerHTML = '<span>⚡ CONFIRM DISPATCH TO AUTHORITY</span>';
  }

  modal.classList.remove('hidden');
  playEmergencyChime();
};

window.closeAuthorityModal = function() {
  const modal = document.getElementById('authority-alert-modal');
  if (modal) modal.classList.add('hidden');
};

window.confirmAuthorityDispatch = function() {
  const reef = CORAL_REEFS[activeAlertReefIndex];
  if (!reef) return;

  const btnConfirm = document.getElementById('btn-confirm-dispatch');
  const dispatchStatus = document.getElementById('modal-dispatch-status');

  if (dispatchStatus) {
    dispatchStatus.innerText = '✅ TRANSMITTED & ACKNOWLEDGED BY LOCAL AGENCY (200 OK)';
    dispatchStatus.className = 'proto-val text-emerald';
  }

  if (btnConfirm) {
    btnConfirm.classList.add('dispatched');
    btnConfirm.innerHTML = '<span>✅ DISPATCH CONFIRMED & PUSHED</span>';
  }

  // 1. Log to Telemetry Terminal
  addLogLine(`[EMERGENCY ECOLOGICAL DISPATCH] SX1278 TX #SAT-ALERT-99401 -> Destination: ${reef.authority} | Target: ${reef.name} | Status: ACKNOWLEDGED (200 OK)`, 'alert');

  // 2. Play acoustic alarm
  playEmergencyChime();

  // 3. Trigger Mission Alert Banner
  triggerAlertBanner(`🚨 Ecological Distress Alert Pushed to: ${reef.authority} [${reef.name}]`);

  // 4. Show Animated Toast Notification
  showToastNotification(
    `🚨 SATELLITE ECOLOGICAL ALERT PUSHED`,
    `Dispatched to: <b>${reef.authority}</b><br><span style="color:#64748b;">Target: ${reef.name} (${reef.region}) &bull; DHW: ${reef.dhw} &bull; Cover: ${reef.cover}</span>`,
    'alert'
  );

  setTimeout(() => {
    closeAuthorityModal();
  }, 1200);
};

// Push Toast Notification Engine
function showToastNotification(title, message, type = 'alert') {
  let container = document.getElementById('toast-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-notification-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification ${type === 'success' ? 'success' : ''}`;
  
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  toast.innerHTML = `
    <div class="toast-header">
      <span class="toast-title">${title}</span>
      <span class="toast-time">${timeStr} UTC</span>
    </div>
    <div class="toast-body">${message}</div>
    <div class="toast-footer">Downlink Protocol: UNEP/NOAA &bull; RF ID: #SAT-ALERT-99401</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

window.targetReefScan = function(index) {
  const reef = CORAL_REEFS[index];
  if (!reef || !map) return;

  map.flyTo([reef.lat, reef.lng], 9, { duration: 1.5 });
  addLogLine(`[CORAL MISSION] Remote Sensor Targeting &bull; ${reef.name} | Auth: ${reef.authority}`, 'alert');
  triggerAlertBanner(`Targeting Reef: ${reef.name} [${reef.lat.toFixed(2)}, ${reef.lng.toFixed(2)}] &bull; Auth: ${reef.authority}`);
};

function setupMapLayerSwitchers() {
  const btnSat = document.getElementById('btn-layer-sat');
  const btnHybrid = document.getElementById('btn-layer-hybrid');
  const btnStreet = document.getElementById('btn-layer-street');

  function switchLayer(layerKey, activeBtn) {
    if (activeMapLayer) map.removeLayer(activeMapLayer);
    activeMapLayer = mapLayers[layerKey];
    activeMapLayer.addTo(map);

    [btnSat, btnHybrid, btnStreet].forEach(b => { if (b) b.classList.remove('active'); });
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (btnSat) btnSat.addEventListener('click', () => switchLayer('satellite', btnSat));
  if (btnHybrid) btnHybrid.addEventListener('click', () => switchLayer('hybrid', btnHybrid));
  if (btnStreet) btnStreet.addEventListener('click', () => switchLayer('street', btnStreet));
}

function updateGPSPosition(lat, lng, alt) {
  if (!map) return;
  if (lat === 0 && lng === 0) return;

  const newLatLng = new L.LatLng(lat, lng);
  if (satMarker) {
    satMarker.setLatLng(newLatLng);
  }

  trackHistory.push(newLatLng);
  if (trackHistory.length > 300) trackHistory.shift();
  if (trackPolyline) trackPolyline.setLatLngs(trackHistory);
}

// ==========================================================================
// 6. CHART.JS REAL-TIME DYNAMICS & THERMAL TIME-SERIES
// ==========================================================================
function initTelemetryChart() {
  const canvas = document.getElementById('telemetryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isLight = currentTheme === 'theme-light';

  telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Altitude (m)',
          data: [],
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          borderWidth: 2,
          pointRadius: 1.2,
          tension: 0.35,
          yAxisID: 'yAlt',
          fill: true,
        },
        {
          label: 'Ambient Temp (°C)',
          data: [],
          borderColor: '#d97706',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 1.2,
          tension: 0.35,
          yAxisID: 'yTemp',
        },
        {
          label: 'IR Target (°C)',
          data: [],
          borderColor: '#e11d48',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 1.2,
          tension: 0.35,
          yAxisID: 'yTemp',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? '#ffffff' : '#0c111c',
          titleColor: isLight ? '#0f172a' : '#f8fafc',
          bodyColor: isLight ? '#334155' : '#94a3b8',
          borderColor: isLight ? '#cbd5e1' : '#1f2b3e',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono', size: 10 },
          bodyFont: { family: 'JetBrains Mono', size: 10 },
          padding: 8,
        },
      },
      scales: {
        x: {
          grid: { color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: isLight ? '#64748b' : '#94a3b8', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 },
        },
        yAlt: {
          type: 'linear',
          position: 'left',
          grid: { color: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.06)' },
          ticks: { color: '#0284c7', font: { family: 'JetBrains Mono', size: 9 } },
          title: { display: true, text: 'Alt (m)', color: '#0284c7', font: { size: 9 } },
        },
        yTemp: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#d97706', font: { family: 'JetBrains Mono', size: 9 } },
          title: { display: true, text: 'Temp (°C)', color: '#d97706', font: { size: 9 } },
        },
      },
    },
  });
}

function updateChart(packetNum, alt, bmpTemp, mlxObj) {
  if (!telemetryChart) return;

  const labels = telemetryChart.data.labels;
  const altData = telemetryChart.data.datasets[0].data;
  const bmpTempData = telemetryChart.data.datasets[1].data;
  const mlxObjData = telemetryChart.data.datasets[2].data;

  labels.push('#' + packetNum);
  altData.push(alt);
  bmpTempData.push(bmpTemp);
  mlxObjData.push(mlxObj);

  if (labels.length > MAX_CHART_POINTS) {
    labels.shift();
    altData.shift();
    bmpTempData.shift();
    mlxObjData.shift();
  }

  telemetryChart.update();
}

// ==========================================================================
// 7. SSE TELEMETRY STREAM (/api/stream)
// ==========================================================================
function initEventSourceStream() {
  const evtSource = new EventSource('/api/stream');

  evtSource.onopen = () => {
    updateSerialStatus(true);
    addLogLine('[LINK] Ground Station SSE Data Bridge Connected', 'info');
  };

  evtSource.onerror = () => {
    if (!isSimMode) {
      updateSerialStatus(false);
    }
  };

  evtSource.onmessage = (event) => {
    if (isStreamPaused) return;
    try {
      const data = JSON.parse(event.data);
      if (data.link_event) {
        triggerAlertBanner(data.link_event);
        addLogLine("🚀 RF HANDSHAKE: " + data.link_event, "alert");
      }
      processTelemetry(data);
    } catch (e) {
      console.error('SSE data decode error:', e);
    }
  };
}

let alertTimer = null;
function triggerAlertBanner(msg) {
  const banner = document.getElementById('mission-alert-banner');
  const textEl = document.getElementById('alert-banner-text');
  if (!banner) return;

  if (textEl && msg) textEl.innerText = msg;
  banner.classList.remove('hidden');

  if (alertTimer) clearTimeout(alertTimer);
  alertTimer = setTimeout(dismissAlertBanner, 6000);
}

function dismissAlertBanner() {
  const banner = document.getElementById('mission-alert-banner');
  if (banner) banner.classList.add('hidden');
}

function updateSerialStatus(isOnline) {
  const dot = document.getElementById('status-serial');
  const txt = document.getElementById('val-serial-text');
  if (isOnline) {
    if (dot) dot.className = 'status-indicator online';
    if (txt) txt.innerText = 'CONNECTED';
  } else {
    if (dot) dot.className = 'status-indicator offline';
    if (txt) txt.innerText = 'OFFLINE';
  }
}

// ==========================================================================
// 8. REAL-TIME TELEMETRY INGESTION & COCKPIT METER ENGINE
// ==========================================================================
function processTelemetry(data) {
  if (!data || !data.packet) return;

  playBeepTone();

  // 1. Packet counter & Serial status
  setText('val-packet-count', '#' + data.packet);
  updateSerialStatus(data.connected);

  // 2. LoRa RF Signal Quality Meter (5-Bar Grade)
  if (data.lora) {
    const rssi = data.lora.rssi;
    const snr = data.lora.snr;
    setText('val-rf-rssi', rssi !== 0 ? `${rssi} dBm` : '-- dBm');
    setText('val-rf-snr', `SNR: ${snr.toFixed(1)} dB`);

    updateRFSignalBars(rssi);

    const loraStatusEl = document.getElementById('val-lora-status');
    if (loraStatusEl) {
      loraStatusEl.innerText = rssi !== 0 ? 'CARRIER LOCKED' : 'SYNCHRONIZED';
    }
  }

  // 3. MPU-6050 6-DOF Inertial Vectors & G-Load Calculation
  const ax = data.mpu.ax, ay = data.mpu.ay, az = data.mpu.az;
  const gx = data.mpu.gx, gy = data.mpu.gy, gz = data.mpu.gz;

  setText('val-ax', (ax >= 0 ? '+' : '') + ax.toFixed(2));
  setText('val-ay', (ay >= 0 ? '+' : '') + ay.toFixed(2));
  setText('val-az', (az >= 0 ? '+' : '') + az.toFixed(2));
  setText('val-gx', (gx >= 0 ? '+' : '') + gx.toFixed(2));
  setText('val-gy', (gy >= 0 ? '+' : '') + gy.toFixed(2));
  setText('val-gz', (gz >= 0 ? '+' : '') + gz.toFixed(2));

  // G-load vector computation
  const gxLoad = ax / 9.81;
  const gyLoad = ay / 9.81;
  const gzLoad = az / 9.81;
  const totalGLoad = Math.sqrt(gxLoad * gxLoad + gyLoad * gyLoad + gzLoad * gzLoad);

  setText('val-g-x', gxLoad.toFixed(2) + ' G');
  setText('val-g-y', gyLoad.toFixed(2) + ' G');
  setText('val-g-z', gzLoad.toFixed(2) + ' G');
  setText('val-total-g', `TOTAL G-LOAD: ${totalGLoad.toFixed(2)} G`);

  setDeflectionBar('bar-g-x', gxLoad);
  setDeflectionBar('bar-g-y', gyLoad);
  setDeflectionBar('bar-g-z', gzLoad);

  // Compute 3D Euler Angles (Pitch & Roll from gravity vector)
  const norm = Math.sqrt(ax * ax + ay * ay + az * az);
  if (norm > 1.0) {
    const nax = ax / norm;
    const nay = ay / norm;
    const naz = az / norm;
    targetPitch = Math.atan2(-nax, Math.sqrt(nay * nay + naz * naz));
    targetRoll = Math.atan2(nay, naz);
  }

  if (Math.abs(gz) > 0.35) {
    targetYaw += gz * 0.05;
  }

  const pitchDeg = (targetPitch * (180 / Math.PI)).toFixed(1);
  const rollDeg = (targetRoll * (180 / Math.PI)).toFixed(1);
  const yawDeg = (((targetYaw - yawOffset) * (180 / Math.PI)) % 360).toFixed(1);

  setText('val-pitch', (Number(pitchDeg) >= 0 ? '+' : '') + pitchDeg + '°');
  setText('val-roll', (Number(rollDeg) >= 0 ? '+' : '') + rollDeg + '°');
  setText('val-yaw', (Number(yawDeg) >= 0 ? '+' : '') + yawDeg + '°');

  // 4. BMP-280 Environmental Data & Variometer Rate of Climb
  const bmpAlt = data.bmp.altitude;
  const bmpPress = data.bmp.pressure;
  const bmpTemp = data.bmp.temp;

  setText('val-bmp-alt', bmpAlt.toFixed(1));
  setText('val-bmp-press', bmpPress.toFixed(1));
  setText('val-bmp-temp', bmpTemp.toFixed(1));

  const now = Date.now();
  const dt = (now - lastAltTime) / 1000;
  if (dt >= 0.5 && lastAlt !== 0) {
    const vs = (bmpAlt - lastAlt) / dt;
    setText('val-variometer', `V/S: ${(vs >= 0 ? '+' : '')}${vs.toFixed(1)} m/s`);
    lastAlt = bmpAlt;
    lastAltTime = now;
  } else if (lastAlt === 0) {
    lastAlt = bmpAlt;
    lastAltTime = now;
  }

  const altPercent = Math.min(100, Math.max(5, (bmpAlt / 1000) * 100));
  const pressPercent = Math.min(100, Math.max(5, ((bmpPress - 800) / 300) * 100));
  const tempPercent = Math.min(100, Math.max(5, ((bmpTemp + 10) / 75) * 100));

  setStyleWidth('bar-alt', altPercent + '%');
  setStyleWidth('bar-press', pressPercent + '%');
  setStyleWidth('bar-bmp-temp', tempPercent + '%');

  // 5. MLX-90614 Contactless Infrared Radiometer
  const ambTemp = data.mlx.ambient;
  const objTemp = data.mlx.object;
  const deltaT = objTemp - ambTemp;

  setText('val-mlx-amb', ambTemp.toFixed(1));
  setText('val-mlx-obj', objTemp.toFixed(1));

  const deltaEl = document.getElementById('val-mlx-delta');
  const statusEl = document.getElementById('val-mlx-status');
  const capEl = document.getElementById('val-mlx-caption');

  if (deltaEl) {
    deltaEl.innerText = (deltaT >= 0 ? '+' : '') + deltaT.toFixed(1);
    if (Math.abs(deltaT) < 1.0) {
      deltaEl.className = 'inst-num mono text-cyan';
      if (statusEl) { statusEl.innerText = 'EQUILIBRIUM'; statusEl.className = 'inst-status-tag mono text-cyan'; }
      if (capEl) capEl.innerText = 'Thermal Balance';
    } else if (deltaT > 0) {
      deltaEl.className = 'inst-num mono text-rose';
      if (statusEl) { statusEl.innerText = 'RADIATING'; statusEl.className = 'inst-status-tag mono text-rose'; }
      if (capEl) capEl.innerText = 'Radiating Heat Flux';
    } else {
      deltaEl.className = 'inst-num mono text-emerald';
      if (statusEl) { statusEl.innerText = 'ABSORBING'; statusEl.className = 'inst-status-tag mono text-emerald'; }
      if (capEl) capEl.innerText = 'Absorbing Heat Sink';
    }
  }

  // 6. GNSS Navigation & Fix
  const lat = data.gps ? data.gps.lat : 0;
  const lng = data.gps ? data.gps.lng : 0;
  const gpsAlt = data.gps ? data.gps.alt : 0;
  const sats = data.gps ? data.gps.sats : 0;

  setText('val-gps-sats', sats + ' SATS');

  const fixPill = document.getElementById('gps-fix-pill');
  const fixText = document.getElementById('gps-fix-text');

  if (sats > 0 && lat !== 0) {
    setText('val-gps-lat', lat.toFixed(6) + '°');
    setText('val-gps-lng', lng.toFixed(6) + '°');
    setText('val-gps-alt', gpsAlt.toFixed(1) + ' m');
    setText('val-gps-spd', (data.gps.speed || 0).toFixed(1) + ' km/h');

    if (fixPill) fixPill.className = 'gps-fix-indicator locked';
    if (fixText) fixText.innerText = '3D FIX LOCKED';

    updateGPSPosition(lat, lng, gpsAlt);
  } else {
    setText('val-gps-lat', 'SEARCHING...');
    setText('val-gps-lng', 'NO FIX');
    setText('val-gps-alt', '-- m');
    setText('val-gps-spd', '0.0 km/h');

    if (fixPill) fixPill.className = 'gps-fix-indicator';
    if (fixText) fixText.innerText = 'SEARCHING FIX';
  }

  // 7. Optical Spectrometer Payload
  if (data.spec) {
    const specPct = data.spec.intensity || 0;
    const specRaw = data.spec.raw || 0;
    const specV = data.spec.voltage || 0;

    setText('val-spec-pct', specPct.toFixed(1));
    setText('val-spec-raw', `${specRaw} / 4095`);
    setText('val-spec-v', specV.toFixed(2) + ' V');
    setStyleWidth('bar-spec', Math.min(100, Math.max(5, specPct)) + '%');

    const specStatus = document.getElementById('val-spec-status');
    if (specStatus) {
      if (specPct > 75) specStatus.innerText = 'DIRECT FLUX';
      else if (specPct > 30) specStatus.innerText = 'DIFFUSE';
      else specStatus.innerText = 'PENUMBRA';
    }
  }

  // 8. Update Real-Time Dynamics Chart
  updateChart(data.packet, bmpAlt, bmpTemp, objTemp);

  // 9. Append to Dual-Mode Telemetry Inspector
  appendTelemetryTableRow(data);
  if (data.raw) {
    addLogLine(`[PKT #${data.packet}] ${data.raw}`, 'telemetry');
  }
}

// Update RF Signal 5-Bar Display
function updateRFSignalBars(rssi) {
  const bars = document.querySelectorAll('#rf-bars .sig-bar');
  if (!bars || bars.length < 5) return;

  bars.forEach(b => b.className = 'sig-bar ' + b.classList[1]);
  if (rssi === 0) return;

  let activeCount = 1;
  let colorClass = 'active-rose';

  if (rssi > -70) {
    activeCount = 5;
    colorClass = 'active-emerald';
  } else if (rssi > -85) {
    activeCount = 4;
    colorClass = 'active-emerald';
  } else if (rssi > -100) {
    activeCount = 3;
    colorClass = 'active-amber';
  } else if (rssi > -112) {
    activeCount = 2;
    colorClass = 'active-amber';
  } else {
    activeCount = 1;
    colorClass = 'active-rose';
  }

  for (let i = 0; i < activeCount; i++) {
    bars[i].classList.add(colorClass);
  }
}

function setDeflectionBar(id, gVal) {
  const el = document.getElementById(id);
  if (!el) return;
  const pct = Math.min(100, Math.max(5, 50 + (gVal / 2.0) * 50));
  el.style.width = pct + '%';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function setStyleWidth(id, width) {
  const el = document.getElementById(id);
  if (el) el.style.width = width;
}

// ==========================================================================
// 9. DUAL-MODE TELEMETRY INSPECTOR (TABLE & CONSOLE)
// ==========================================================================
function switchTelemetryView(mode) {
  currentViewMode = mode;
  const btnTable = document.getElementById('tab-btn-table');
  const btnRaw = document.getElementById('tab-btn-raw');
  const tableContainer = document.getElementById('telemetry-table-container');
  const rawContainer = document.getElementById('telemetry-raw-container');

  if (mode === 'table') {
    if (btnTable) btnTable.classList.add('active');
    if (btnRaw) btnRaw.classList.remove('active');
    if (tableContainer) tableContainer.classList.remove('hidden');
    if (rawContainer) rawContainer.classList.add('hidden');
  } else {
    if (btnRaw) btnRaw.classList.add('active');
    if (btnTable) btnTable.classList.remove('active');
    if (rawContainer) rawContainer.classList.remove('hidden');
    if (tableContainer) tableContainer.classList.add('hidden');
  }
}

function appendTelemetryTableRow(data) {
  const tbody = document.getElementById('telemetry-table-body');
  if (!tbody) return;

  const placeholder = tbody.querySelector('.table-placeholder-row');
  if (placeholder) placeholder.remove();

  const prevLatest = tbody.querySelector('.table-row-latest');
  if (prevLatest) prevLatest.classList.remove('table-row-latest');

  const tr = document.createElement('tr');
  tr.className = 'table-row-latest';

  const now = new Date();
  const timeStr = now.toISOString().split('T')[1].replace('Z', '');

  const rssiStr = data.lora ? `${data.lora.rssi} dBm` : '--';
  const snrStr = data.lora ? `${data.lora.snr.toFixed(1)} dB` : '--';
  const deltaT = (data.mlx.object - data.mlx.ambient).toFixed(1);
  const accelStr = `${data.mpu.ax.toFixed(1)}, ${data.mpu.ay.toFixed(1)}, ${data.mpu.az.toFixed(1)}`;
  const satsStr = data.gps ? `${data.gps.sats}` : '0';

  tr.innerHTML = `
    <td class="text-cyan">${timeStr}</td>
    <td><b>#${data.packet}</b></td>
    <td>${rssiStr}</td>
    <td>${snrStr}</td>
    <td class="text-cyan">${data.bmp.altitude.toFixed(1)}</td>
    <td>${data.bmp.pressure.toFixed(1)}</td>
    <td class="text-amber">${data.bmp.temp.toFixed(1)}</td>
    <td class="text-rose">${data.mlx.object.toFixed(1)}</td>
    <td>${data.mlx.ambient.toFixed(1)}</td>
    <td>${deltaT > 0 ? '+' : ''}${deltaT}</td>
    <td class="text-purple">${(data.spec ? data.spec.intensity : 0).toFixed(1)}%</td>
    <td>${accelStr}</td>
    <td>${satsStr}</td>
    <td class="cell-crc-ok">OK (VALID)</td>
  `;

  tbody.insertBefore(tr, tbody.firstChild);

  while (tbody.children.length > MAX_TABLE_ROWS) {
    tbody.removeChild(tbody.lastChild);
  }
}

function addLogLine(text, type = 'info') {
  const feed = document.getElementById('telemetry-raw-container');
  if (!feed) return;

  const line = document.createElement('div');
  line.className = `stream-line ${type === 'telemetry' ? 'line-tlm' : type === 'alert' ? 'line-alert' : 'line-sys'}`;
  
  const now = new Date();
  const timeTag = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  line.innerText = `[${timeTag}] ${text}`;

  feed.appendChild(line);

  while (feed.children.length > 150) {
    feed.removeChild(feed.firstChild);
  }

  feed.scrollTop = feed.scrollHeight;
}

// ==========================================================================
// 10. WEB AUDIO ACOUSTIC BEEP TONE GENERATOR
// ==========================================================================
function initWebAudio() {
  const audioBtn = document.getElementById('btn-audio-toggle');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      isAudioEnabled = !isAudioEnabled;
      if (isAudioEnabled && !audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      audioBtn.style.color = isAudioEnabled ? 'var(--emerald)' : 'var(--text-secondary)';
      audioBtn.style.borderColor = isAudioEnabled ? 'var(--emerald)' : 'var(--border-card)';
      
      const icon = document.getElementById('audio-icon');
      if (icon) {
        if (isAudioEnabled) {
          icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
        } else {
          icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
        }
      }

      if (isAudioEnabled) playBeepTone();
    });
  }
}

function playBeepTone() {
  if (!isAudioEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    console.error('Audio tone error:', e);
  }
}

function playEmergencyChime() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  if (!audioCtx) return;

  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const t = audioCtx.currentTime;
    // Tone 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(880, t);
    gain1.gain.setValueAtTime(0.12, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(t);
    osc1.stop(t + 0.13);

    // Tone 2 (Higher Pitch Urgency)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, t + 0.15);
    gain2.gain.setValueAtTime(0.15, t + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(t + 0.15);
    osc2.stop(t + 0.36);
  } catch (e) {
    console.error('Emergency chime audio error:', e);
  }
}

// ==========================================================================
// 11. SIMULATION TELEMETRY GENERATOR (LIVE BENCH TEST)
// ==========================================================================
let simPacketCounter = 1;
let simAlt = 120.0, simLat = GS_COORDS.lat, simLng = GS_COORDS.lng;

function toggleSimMode() {
  isSimMode = !isSimMode;
  const btnSim = document.getElementById('btn-sim-mode');
  const txtSim = document.getElementById('btn-sim-text');

  if (isSimMode) {
    if (btnSim) btnSim.classList.add('active-sim');
    if (txtSim) txtSim.innerText = 'SIM: ACTIVE';
    updateSerialStatus(true);
    addLogLine('[SIMULATOR] Ground Station Simulator Active (1.5 Hz Injection)', 'alert');

    simInterval = setInterval(() => {
      if (isStreamPaused) return;
      simPacketCounter++;
      simAlt += (Math.random() - 0.48) * 1.8;
      simLat += 0.0008;
      simLng += 0.0012;

      const mockData = {
        packet: simPacketCounter,
        connected: true,
        source: 'Simulator',
        timestamp: Date.now() / 1000,
        lora: {
          rssi: -72 - Math.floor(Math.random() * 15),
          snr: 8.5 + (Math.random() - 0.5) * 2,
          gs_packets: simPacketCounter,
        },
        mpu: {
          ax: (Math.random() - 0.5) * 0.8,
          ay: (Math.random() - 0.5) * 0.8,
          az: 9.78 + (Math.random() - 0.5) * 0.2,
          gx: (Math.random() - 0.5) * 0.04,
          gy: (Math.random() - 0.5) * 0.04,
          gz: (Math.random() - 0.5) * 0.04,
        },
        bmp: {
          temp: 24.2 + (Math.random() - 0.5) * 0.4,
          pressure: 1012.4 + (Math.random() - 0.5) * 0.5,
          altitude: Math.max(0, simAlt),
        },
        mlx: {
          ambient: 24.8 + (Math.random() - 0.5) * 0.3,
          object: 26.5 + (Math.random() - 0.5) * 1.2,
        },
        spec: {
          raw: 1850 + Math.floor((Math.random() - 0.5) * 200),
          voltage: 1.48 + (Math.random() - 0.5) * 0.15,
          intensity: 45.2 + (Math.random() - 0.5) * 5,
        },
        gps: {
          lat: simLat,
          lng: simLng,
          alt: simAlt + 10,
          speed: 28.4 + (Math.random() - 0.5) * 2,
          sats: 8,
        },
        raw: `PKT:${simPacketCounter},AX:0.02,AY:-0.01,AZ:9.80,ALT:${simAlt.toFixed(1)},PRESS:1012.4,BMP:24.2,MLX_OBJ:26.5,MLX_AMB:24.8,SPEC:45.2,GPS:${simLat.toFixed(4)},${simLng.toFixed(4)},${simAlt.toFixed(1)},RSSI:-75,SNR:8.5`,
      };

      processTelemetry(mockData);
    }, 800);

  } else {
    if (btnSim) btnSim.classList.remove('active-sim');
    if (txtSim) txtSim.innerText = 'SIM: OFF';
    if (simInterval) clearInterval(simInterval);
    addLogLine('[SIMULATOR] Telemetry simulation stopped.', 'info');
  }
}

// ==========================================================================
// 12. UI CONTROLS & INTERACTION WIRING
// ==========================================================================
function initUIControls() {
  // Sim Mode Button
  const btnSim = document.getElementById('btn-sim-mode');
  if (btnSim) {
    btnSim.addEventListener('click', toggleSimMode);
  }

  // Clear Terminal Button
  const btnClear = document.getElementById('btn-clear-term');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const feed = document.getElementById('telemetry-raw-container');
      if (feed) feed.innerHTML = '';
      const tbody = document.getElementById('telemetry-table-body');
      if (tbody) tbody.innerHTML = '<tr class="table-placeholder-row"><td colspan="14" class="text-center text-muted">Awaiting LoRa telemetry downlink frames from CubeSat-1...</td></tr>';
      addLogLine('[SYSTEM] Terminal and table telemetry buffers cleared.', 'info');
    });
  }

  // Stream Pause / Resume Button
  const btnPause = document.getElementById('btn-pause-stream');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      isStreamPaused = !isStreamPaused;
      btnPause.innerText = isStreamPaused ? 'RESUME' : 'PAUSE';
      btnPause.style.color = isStreamPaused ? 'var(--amber)' : 'var(--text-secondary)';
      btnPause.style.borderColor = isStreamPaused ? 'var(--amber)' : 'var(--border-card)';
      addLogLine(isStreamPaused ? '[SYSTEM] Stream ingest paused.' : '[SYSTEM] Stream ingest resumed.', 'info');
    });
  }

  // Zero Yaw IMU Reference
  const btnZero = document.getElementById('btn-zero-imu');
  if (btnZero) {
    btnZero.addEventListener('click', () => {
      yawOffset = targetYaw;
      setText('val-yaw', '+0.0°');
      addLogLine('[ADCS] Yaw spatial reference zeroed to current attitude.', 'info');
    });
  }

  // Reset 3D Camera View
  const btnResetCam = document.getElementById('btn-reset-cam');
  if (btnResetCam) {
    btnResetCam.addEventListener('click', () => {
      camRotX = 0.45;
      camRotY = -0.75;
      camDist = 3.6;
      updateCameraPos();
    });
  }

  // Map Center Sat View
  const btnMapSat = document.getElementById('btn-map-center-sat');
  if (btnMapSat) {
    btnMapSat.addEventListener('click', () => {
      if (satMarker && map) {
        map.setView(satMarker.getLatLng(), 8);
      }
    });
  }

  // Map Center Ground Station
  const btnMapGS = document.getElementById('btn-map-center-gs');
  if (btnMapGS) {
    btnMapGS.addEventListener('click', () => {
      if (map) {
        map.setView([GS_COORDS.lat, GS_COORDS.lng], 5);
      }
    });
  }

  // Fullscreen Cockpit Mode
  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }
}
