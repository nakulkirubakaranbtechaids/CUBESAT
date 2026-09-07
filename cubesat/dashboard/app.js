// ==========================================================================
// CUBESAT MISSION CONTROL - MAIN APPLICATION LOGIC
// ==========================================================================

let map, marker, trackPolyline;
let trackHistory = [];
let telemetryChart;
let cubeMesh;
let scene, camera, renderer;

// Real-time smoothing variables for 3D attitude
let targetPitch = 0, targetRoll = 0, targetYaw = 0;
let currentPitch = 0, currentRoll = 0, currentYaw = 0;

// Maximum chart points
const MAX_CHART_POINTS = 30;

// ==========================================================================
// 1. INITIALIZE ON DOM LOAD
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initUTCClock();
  initThreeJSAttitude();
  initLeafletMap();
  initTelemetryChart();
  initEventSourceStream();
  initUIControls();
});

// ==========================================================================
// 2. UTC MISSION CLOCK
// ==========================================================================
function initUTCClock() {
  const clockEl = document.getElementById('utc-clock');
  function update() {
    const now = new Date();
    clockEl.innerText = now.toUTCString().split(' ')[4] + ' UTC';
  }
  update();
  setInterval(update, 1000);
}

// ==========================================================================
// 3. THREE.JS 3D CUBESAT ATTITUDE VISUALIZER
// ==========================================================================
function initThreeJSAttitude() {
  const container = document.getElementById('threejs-attitude-canvas');
  const width = container.clientWidth || 340;
  const height = container.clientHeight || 220;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 1.8, 3.8);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.2);
  dirLight1.position.set(5, 10, 7);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffb700, 0.6);
  dirLight2.position.set(-5, -5, -5);
  scene.add(dirLight2);

  // Build CubeSat Model (1U CubeSat with Solar Panels & Antennas)
  const cubesatGroup = new THREE.Group();

  // 1U Chassis (10x10x10 cm scaled to 1.2x1.2x1.2)
  const bodyGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  cubesatGroup.add(bodyMesh);

  // Chassis Gold Foil Accent (Kapton Thermal Insulation)
  const foilGeo = new THREE.BoxGeometry(1.21, 1.0, 1.0);
  const foilMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.9,
    roughness: 0.3
  });
  const foilMesh = new THREE.Mesh(foilGeo, foilMat);
  cubesatGroup.add(foilMesh);

  // Solar Panels (Left & Right deployable wings)
  const panelGeo = new THREE.BoxGeometry(1.2, 0.04, 1.0);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    metalness: 0.5,
    roughness: 0.2
  });

  const leftPanel = new THREE.Mesh(panelGeo, panelMat);
  leftPanel.position.set(-1.25, 0, 0);
  cubesatGroup.add(leftPanel);

  const rightPanel = new THREE.Mesh(panelGeo, panelMat);
  rightPanel.position.set(1.25, 0, 0);
  cubesatGroup.add(rightPanel);

  // LoRa Monopole Antenna
  const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2, 8);
  const antMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
  const antenna = new THREE.Mesh(antGeo, antMat);
  antenna.position.set(0.45, 1.1, 0.45);
  cubesatGroup.add(antenna);

  // Orientation Axes Helper (Subtle glowing)
  const axes = new THREE.AxesHelper(1.6);
  cubesatGroup.add(axes);

  scene.add(cubesatGroup);
  cubeMesh = cubesatGroup;

  // Render loop
  function animate() {
    requestAnimationFrame(animate);

    // Smooth interpolation (lerp) toward target pitch, roll, yaw
    currentPitch += (targetPitch - currentPitch) * 0.1;
    currentRoll  += (targetRoll - currentRoll) * 0.1;
    currentYaw   += (targetYaw - currentYaw) * 0.05;

    if (cubeMesh) {
      cubeMesh.rotation.x = currentPitch;
      cubeMesh.rotation.z = currentRoll;
      cubeMesh.rotation.y = currentYaw;
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

// ==========================================================================
// 4. LEAFLET GPS MAP (NEO-6M)
// ==========================================================================
function initLeafletMap() {
  // Default coordinates (e.g. from telemetry: 12.960263, 79.138419)
  const initialLat = 12.960263;
  const initialLng = 79.138419;

  map = L.map('gps-map', {
    zoomControl: true,
    attributionControl: false
  }).setView([initialLat, initialLng], 15);

  // Clean OpenStreetMap tiles (dark styled via CSS filter)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc'
  }).addTo(map);

  // Custom Pulsing Satellite Marker
  const satIcon = L.divIcon({
    className: 'custom-sat-icon',
    html: `<div style="
      width: 14px;
      height: 14px;
      background: #00f0ff;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 15px #00f0ff;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  marker = L.marker([initialLat, initialLng], { icon: satIcon }).addTo(map);
  marker.bindPopup("<b style='color:#000;'>CubeSat-1</b><br>Ground Track Location");

  trackPolyline = L.polyline([], {
    color: '#00f0ff',
    weight: 3,
    opacity: 0.8,
    dashArray: '4, 6'
  }).addTo(map);
}

function updateGPSPosition(lat, lng, alt) {
  if (!map || !marker) return;
  if (lat === 0 && lng === 0) return; // Wait for valid GPS fix

  const newLatLng = new L.LatLng(lat, lng);
  marker.setLatLng(newLatLng);

  trackHistory.push(newLatLng);
  if (trackHistory.length > 200) trackHistory.shift();
  trackPolyline.setLatLngs(trackHistory);

  map.panTo(newLatLng);
}

// ==========================================================================
// 5. CHART.JS REAL-TIME TELEMETRY GRAPH
// ==========================================================================
function initTelemetryChart() {
  const ctx = document.getElementById('telemetryChart').getContext('2d');

  telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'BMP280 Altitude (m)',
          data: [],
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.08)',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.35,
          yAxisID: 'yAlt',
          fill: true
        },
        {
          label: 'BMP280 Temp (°C)',
          data: [],
          borderColor: '#ffb700',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.35,
          yAxisID: 'yTemp'
        },
        {
          label: 'MLX90614 Target Temp (°C)',
          data: [],
          borderColor: '#ff3366',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.35,
          yAxisID: 'yTemp'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        },
        yAlt: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(0, 240, 255, 0.08)' },
          ticks: { color: '#00f0ff', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: 'Altitude (m)', color: '#00f0ff', font: { size: 11 } }
        },
        yTemp: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#ffb700', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: 'Temp (°C)', color: '#ffb700', font: { size: 11 } }
        }
      }
    }
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
// 6. SSE TELEMETRY STREAM (/api/stream)
// ==========================================================================
function initEventSourceStream() {
  const evtSource = new EventSource('/api/stream');

  evtSource.onopen = () => {
    updateSerialStatus(true);
    addLogLine('[LINK] Connected to Telemetry Stream via SSE', 'info');
  };

  evtSource.onerror = () => {
    updateSerialStatus(false);
  };

  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.link_event) {
        showLinkToast(data.link_event);
        addLogLine("🚀 " + data.link_event, "info");
      }
      processTelemetry(data);
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  };
}

let toastTimer = null;
function showLinkToast(msg) {
  const toast = document.getElementById('link-toast');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast) return;

  if (toastMsg && msg) {
    toastMsg.innerText = msg;
  }
  toast.classList.remove('hidden');
  toast.classList.add('visible');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 500);
  }, 5000);
}

function updateSerialStatus(isOnline) {
  const dot = document.getElementById('status-serial');
  const txt = document.getElementById('val-serial-text');
  if (isOnline) {
    dot.className = 'status-indicator online';
    txt.innerText = 'CONNECTED';
  } else {
    dot.className = 'status-indicator offline';
    txt.innerText = 'OFFLINE';
  }
}

// ==========================================================================
// 7. PROCESS REAL-TIME TELEMETRY DATA
// ==========================================================================
function processTelemetry(data) {
  if (!data || !data.packet) return;

  // 1. Packet counter & Header metrics
  document.getElementById('val-packet-count').innerText = data.packet;
  updateSerialStatus(data.connected);

  // LoRa RF link quality (ground station mode)
  if (data.lora) {
    const rssiEl = document.getElementById('val-lora-rssi');
    const snrEl  = document.getElementById('val-lora-snr');
    const loraStatusEl = document.getElementById('val-lora-status');
    if (rssiEl && data.lora.rssi !== 0) {
      rssiEl.innerText = data.lora.rssi + ' dBm';
      // Color RSSI: green > -80, amber -80 to -100, red < -100
      if (data.lora.rssi > -80) rssiEl.className = 'value number-font cyber-lime';
      else if (data.lora.rssi > -100) rssiEl.className = 'value number-font cyber-amber';
      else rssiEl.className = 'value number-font cyber-red';
    }
    if (snrEl && data.lora.snr !== 0) {
      snrEl.innerText = data.lora.snr + ' dB';
    }
    if (loraStatusEl) {
      loraStatusEl.innerText = data.lora.rssi !== 0 ? 'GS RECEIVING' : 'ACTIVE';
    }
  }

  // 2. MPU-6050 Readouts & 3D Attitude
  const ax = data.mpu.ax, ay = data.mpu.ay, az = data.mpu.az;
  const gx = data.mpu.gx, gy = data.mpu.gy, gz = data.mpu.gz;

  document.getElementById('val-ax').innerText = (ax >= 0 ? '+' : '') + ax.toFixed(2);
  document.getElementById('val-ay').innerText = (ay >= 0 ? '+' : '') + ay.toFixed(2);
  document.getElementById('val-az').innerText = (az >= 0 ? '+' : '') + az.toFixed(2);

  document.getElementById('val-gx').innerText = (gx >= 0 ? '+' : '') + gx.toFixed(2);
  document.getElementById('val-gy').innerText = (gy >= 0 ? '+' : '') + gy.toFixed(2);
  document.getElementById('val-gz').innerText = (gz >= 0 ? '+' : '') + gz.toFixed(2);

  // Compute accurate 3D pitch and roll directly from accelerometer gravity vector
  const norm = Math.sqrt(ax * ax + ay * ay + az * az);
  if (norm > 1.0) {
    const nax = ax / norm;
    const nay = ay / norm;
    const naz = az / norm;

    targetPitch = Math.atan2(-nax, Math.sqrt(nay * nay + naz * naz));
    targetRoll  = Math.atan2(nay, naz);
  }

  // Only accumulate yaw if angular rate is genuinely rotating (deadband threshold > 0.35 rad/s)
  // This prevents stationary gyro noise from creating continuous auto-spinning
  if (Math.abs(gz) > 0.35) {
    targetYaw += gz * 0.05;
  }

  const pitchDeg = (targetPitch * (180 / Math.PI)).toFixed(1);
  const rollDeg  = (targetRoll * (180 / Math.PI)).toFixed(1);
  const yawDeg   = ((targetYaw * (180 / Math.PI)) % 360).toFixed(1);

  document.getElementById('val-pitch').innerText = (pitchDeg >= 0 ? '+' : '') + pitchDeg + '°';
  document.getElementById('val-roll').innerText = (rollDeg >= 0 ? '+' : '') + rollDeg + '°';
  document.getElementById('val-yaw').innerText = yawDeg + '°';

  // 3. BMP-280 Environmental Data
  const bmpAlt = data.bmp.altitude;
  const bmpPress = data.bmp.pressure;
  const bmpTemp = data.bmp.temp;

  document.getElementById('val-bmp-alt').innerText = bmpAlt.toFixed(1);
  document.getElementById('val-bmp-press').innerText = bmpPress.toFixed(1);
  document.getElementById('val-bmp-temp').innerText = bmpTemp.toFixed(1);

  // Update progress bars
  const altPercent = Math.min(100, Math.max(5, (bmpAlt / 1000) * 100));
  const pressPercent = Math.min(100, Math.max(5, ((bmpPress - 800) / 300) * 100));
  const tempPercent = Math.min(100, Math.max(5, ((bmpTemp + 10) / 60) * 100));

  document.getElementById('bar-alt').style.width = altPercent + '%';
  document.getElementById('bar-press').style.width = pressPercent + '%';
  document.getElementById('bar-bmp-temp').style.width = tempPercent + '%';

  // 4. MLX-90614 Thermal Readouts
  const ambTemp = data.mlx.ambient;
  const objTemp = data.mlx.object;
  const deltaT = objTemp - ambTemp;

  document.getElementById('val-mlx-amb').innerText = ambTemp.toFixed(1);
  document.getElementById('val-mlx-obj').innerText = objTemp.toFixed(1);

  const deltaEl = document.getElementById('val-mlx-delta');
  deltaEl.innerText = (deltaT >= 0 ? '+' : '') + deltaT.toFixed(1);
  if (Math.abs(deltaT) < 1.0) {
    deltaEl.className = 'thermo-val cyber-cyan';
    document.getElementById('val-mlx-status').innerText = 'THERMAL EQUILIBRIUM';
  } else if (deltaT > 0) {
    deltaEl.className = 'thermo-val cyber-red';
    document.getElementById('val-mlx-status').innerText = 'TARGET RADIATING HEAT';
  } else {
    deltaEl.className = 'thermo-val cyber-lime';
    document.getElementById('val-mlx-status').innerText = 'TARGET ABSORBING HEAT';
  }

  // 5. GPS Navigation
  try {
    const lat = data.gps ? data.gps.lat : 0;
    const lng = data.gps ? data.gps.lng : 0;
    const gpsAlt = data.gps ? data.gps.alt : 0;
    const sats = data.gps ? data.gps.sats : 0;

    const satBadge = document.querySelector('.sat-lock-badge');
    const satValEl = document.getElementById('val-gps-sats');
    const latEl = document.getElementById('val-gps-lat');
    const lngEl = document.getElementById('val-gps-lng');
    const altEl = document.getElementById('val-gps-alt');
    const spdEl = document.getElementById('val-gps-spd');

    if (sats > 0 && lat !== 0) {
      if (latEl) latEl.innerText = lat.toFixed(6) + '°';
      if (lngEl) lngEl.innerText = lng.toFixed(6) + '°';
      if (altEl) altEl.innerText = gpsAlt.toFixed(1) + ' m';
      if (spdEl) spdEl.innerText = (data.gps.speed || 0).toFixed(1) + ' km/h';
      if (satValEl) satValEl.innerText = sats;
      if (satBadge) {
        satBadge.style.background = 'rgba(0, 255, 136, 0.15)';
        satBadge.style.borderColor = 'rgba(0, 255, 136, 0.4)';
      }
      updateGPSPosition(lat, lng, gpsAlt);
    } else {
      if (latEl) latEl.innerHTML = '<span class="cyber-amber" style="font-size:0.75rem;">SEARCHING FIX...</span>';
      if (lngEl) lngEl.innerHTML = '<span style="font-size:0.7rem; color:#94a3b8;">Place near window</span>';
      if (altEl) altEl.innerText = 'WAITING';
      if (spdEl) spdEl.innerText = '0.0 km/h';
      if (satValEl) satValEl.innerText = '0';
      if (satBadge) {
        satBadge.style.background = 'rgba(255, 183, 0, 0.12)';
        satBadge.style.borderColor = 'rgba(255, 183, 0, 0.35)';
      }
    }
  } catch (gpsErr) {
    console.warn('GPS UI update warning:', gpsErr);
  }

  // 6. Analog IR Spectrometer (GPIO 34 ADC1)
  try {
    if (data.spec) {
      const specPct = data.spec.intensity || 0;
      const specRaw = data.spec.raw || 0;
      const specV = data.spec.voltage || 0;

      const pctEl = document.getElementById('val-spec-pct');
      const rawEl = document.getElementById('val-spec-raw');
      const vEl = document.getElementById('val-spec-v');
      const barEl = document.getElementById('bar-spec');
      const statusEl = document.getElementById('val-spec-status');

      if (pctEl) pctEl.innerText = specPct.toFixed(1);
      if (rawEl) rawEl.innerText = specRaw;
      if (vEl) vEl.innerText = specV.toFixed(2) + ' V';
      if (barEl) barEl.style.width = Math.min(100, Math.max(5, specPct)) + '%';
      if (statusEl) {
        if (specPct > 70) {
          statusEl.innerText = 'HIGH IR FLUX';
          statusEl.className = 'cyber-red';
        } else if (specPct > 25) {
          statusEl.innerText = 'DIFFUSE AMBIENT';
          statusEl.className = 'cyber-lime';
        } else {
          statusEl.innerText = 'LOW / SHADOW';
          statusEl.className = 'cyber-cyan';
        }
      }
    }
  } catch (specErr) {
    console.warn('Spectrometer UI update warning:', specErr);
  }

  // 7. Update Real-Time Chart
  try {
    updateChart(data.packet, bmpAlt, bmpTemp, objTemp);
  } catch (chartErr) {
    console.warn('Chart update warning:', chartErr);
  }

  // 8. Add to Terminal Feed
  try {
    if (data.raw) {
      addLogLine(`[PKT #${data.packet}] ${data.raw}`, 'telemetry');
    }
  } catch (termErr) {
    console.warn('Terminal log warning:', termErr);
  }
}

// ==========================================================================
// 8. TERMINAL STREAM LOGGING
// ==========================================================================
function addLogLine(text, type = 'info') {
  const feed = document.getElementById('terminal-feed');
  if (!feed) return;

  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.innerText = text;

  feed.appendChild(line);

  // Keep terminal feed clean (last 100 entries)
  while (feed.children.length > 100) {
    feed.removeChild(feed.firstChild);
  }

  feed.scrollTop = feed.scrollHeight;
}

function initUIControls() {
  const btnClear = document.getElementById('btn-clear-term');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      document.getElementById('terminal-feed').innerHTML = '';
      addLogLine('[SYSTEM] Log cleared.', 'info');
    });
  }

  const btnZero = document.getElementById('btn-zero-imu');
  if (btnZero) {
    btnZero.addEventListener('click', () => {
      targetYaw = 0;
      currentYaw = 0;
      document.getElementById('val-yaw').innerText = '+0.0°';
      addLogLine('[IMU] Yaw orientation re-zeroed.', 'info');
    });
  }
}
