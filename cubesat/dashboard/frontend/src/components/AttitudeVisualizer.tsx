import React, { useEffect, useRef, useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import * as THREE from 'three';
import type { MpuData } from '../types/telemetry';


interface AttitudeVisualizerProps {
  mpu: MpuData;
}

export const AttitudeVisualizer: React.FC<AttitudeVisualizerProps> = ({ mpu }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const anglesRef = useRef<{
    targetPitch: number;
    targetRoll: number;
    targetYaw: number;
    currentPitch: number;
    currentRoll: number;
    currentYaw: number;
  }>({
    targetPitch: 0,
    targetRoll: 0,
    targetYaw: 0,
    currentPitch: 0,
    currentRoll: 0,
    currentYaw: 0,
  });

  const [displayAngles, setDisplayAngles] = useState<{
    pitch: string;
    roll: string;
    yaw: string;
  }>({
    pitch: '+0.0°',
    roll: '+0.0°',
    yaw: '+0.0°',
  });

  // Calculate target pitch and roll from accelerometer gravity vector & gyro yaw
  useEffect(() => {
    const { ax, ay, az, gz } = mpu;
    const norm = Math.sqrt(ax * ax + ay * ay + az * az);

    if (norm > 1.0) {
      const nax = ax / norm;
      const nay = ay / norm;
      const naz = az / norm;

      anglesRef.current.targetPitch = Math.atan2(-nax, Math.sqrt(nay * nay + naz * naz));
      anglesRef.current.targetRoll = Math.atan2(nay, naz);
    }

    if (Math.abs(gz) > 0.35) {
      anglesRef.current.targetYaw += gz * 0.05;
    }

    const pitchDeg = (anglesRef.current.targetPitch * (180 / Math.PI)).toFixed(1);
    const rollDeg = (anglesRef.current.targetRoll * (180 / Math.PI)).toFixed(1);
    const yawDeg = ((anglesRef.current.targetYaw * (180 / Math.PI)) % 360).toFixed(1);

    setDisplayAngles({
      pitch: (Number(pitchDeg) >= 0 ? '+' : '') + pitchDeg + '°',
      roll: (Number(rollDeg) >= 0 ? '+' : '') + rollDeg + '°',
      yaw: (Number(yawDeg) >= 0 ? '+' : '') + yawDeg + '°',
    });
  }, [mpu]);

  // Handle Zero Yaw button click
  const handleZeroYaw = () => {
    anglesRef.current.targetYaw = 0;
    anglesRef.current.currentYaw = 0;
    setDisplayAngles((prev) => ({ ...prev, yaw: '+0.0°' }));
  };

  // Setup Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = 220;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.8, 3.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.innerHTML = '';
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

    // CubeSat 3D Model Group
    const cubesatGroup = new THREE.Group();

    // 1U Chassis (10x10x10 cm scaled)
    const bodyGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    cubesatGroup.add(bodyMesh);

    // Kapton Thermal Foil
    const foilGeo = new THREE.BoxGeometry(1.21, 1.0, 1.0);
    const foilMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.3,
    });
    const foilMesh = new THREE.Mesh(foilGeo, foilMat);
    cubesatGroup.add(foilMesh);

    // Deployable Solar Panels (Left & Right Wings)
    const panelGeo = new THREE.BoxGeometry(1.2, 0.04, 1.0);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      metalness: 0.5,
      roughness: 0.2,
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

    // Orientation Axes Helper
    const axes = new THREE.AxesHelper(1.6);
    cubesatGroup.add(axes);

    scene.add(cubesatGroup);

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth interpolation (lerp)
      anglesRef.current.currentPitch +=
        (anglesRef.current.targetPitch - anglesRef.current.currentPitch) * 0.1;
      anglesRef.current.currentRoll +=
        (anglesRef.current.targetRoll - anglesRef.current.currentRoll) * 0.1;
      anglesRef.current.currentYaw +=
        (anglesRef.current.targetYaw - anglesRef.current.currentYaw) * 0.05;

      cubesatGroup.rotation.x = anglesRef.current.currentPitch;
      cubesatGroup.rotation.z = anglesRef.current.currentRoll;
      cubesatGroup.rotation.y = anglesRef.current.currentYaw;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  const { ax, ay, az, gx, gy, gz } = mpu;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        avatar={<ExploreIcon sx={{ color: '#00f0ff' }} />}
        title="3D ATTITUDE & ORIENTATION (MPU-6050)"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<RestartAltIcon />}
              onClick={handleZeroYaw}
              sx={{ fontSize: '0.65rem', py: 0.3 }}
            >
              ZERO YAW
            </Button>
            <Chip label="I2C: 0x68" size="small" sx={{ color: '#00f0ff', borderColor: '#00f0ff' }} variant="outlined" />
          </Box>
        }
      />
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Three.js Viewport */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: 220,
            borderRadius: 1,
            backgroundColor: 'rgba(3, 7, 18, 0.7)',
            border: '1px solid rgba(0, 240, 255, 0.1)',
            overflow: 'hidden',
          }}
        >
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

          {/* Crosshair Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 40,
              height: 40,
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: '50%',
              pointerEvents: 'none',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: -6,
                right: -6,
                height: 1,
                backgroundColor: 'rgba(0, 240, 255, 0.35)',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                left: '50%',
                top: -6,
                bottom: -6,
                width: 1,
                backgroundColor: 'rgba(0, 240, 255, 0.35)',
              },
            }}
          />

          {/* Angles HUD Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 10,
              backgroundColor: 'rgba(11, 19, 32, 0.75)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              fontSize: '0.68rem',
              fontFamily: 'JetBrains Mono, monospace',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.3,
            }}
          >
            <Typography variant="caption" sx={{ fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>
              PITCH: <span style={{ color: '#00f0ff', fontWeight: 700 }}>{displayAngles.pitch}</span>
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>
              ROLL: <span style={{ color: '#00f0ff', fontWeight: 700 }}>{displayAngles.roll}</span>
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>
              YAW: <span style={{ color: '#00f0ff', fontWeight: 700 }}>{displayAngles.yaw}</span>
            </Typography>
          </Box>
        </Box>

        {/* Accel & Gyro Readout Table */}
        <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontSize: '0.65rem', py: 0.5, color: '#64748b' } }}>
                <TableCell>AXIS</TableCell>
                <TableCell align="right">ACCEL (m/s²)</TableCell>
                <TableCell align="right">GYRO (rad/s)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { fontSize: '0.75rem', py: 0.5, fontFamily: 'JetBrains Mono' } }}>
              <TableRow>
                <TableCell sx={{ color: '#ff3366', fontWeight: 700 }}>X</TableCell>
                <TableCell align="right" sx={{ color: '#f1f5f9' }}>
                  {(ax >= 0 ? '+' : '') + ax.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ color: '#f1f5f9' }}>
                  {(gx >= 0 ? '+' : '') + gx.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ color: '#00ff88', fontWeight: 700 }}>Y</TableCell>
                <TableCell align="right" sx={{ color: '#f1f5f9' }}>
                  {(ay >= 0 ? '+' : '') + ay.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ color: '#f1f5f9' }}>
                  {(gy >= 0 ? '+' : '') + gy.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ color: '#00f0ff', fontWeight: 700 }}>Z</TableCell>
                <TableCell align="right" sx={{ color: '#f1f5f9' }}>
                  {(az >= 0 ? '+' : '') + az.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ color: '#f1f5f9' }}>
                  {(gz >= 0 ? '+' : '') + gz.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};
