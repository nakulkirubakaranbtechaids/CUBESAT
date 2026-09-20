import React from 'react';
import { ThemeProvider, CssBaseline, Box, Grid } from '@mui/material';
import { theme } from './theme/theme';
import { useTelemetry } from './hooks/useTelemetry';
import { HeaderHud } from './components/HeaderHud';
import { AttitudeVisualizer } from './components/AttitudeVisualizer';
import { GpsTracker } from './components/GpsTracker';
import { AtmosphericPanel } from './components/AtmosphericPanel';
import { ThermalRadiometerPanel } from './components/ThermalRadiometerPanel';
import { SpectrometerPanel } from './components/SpectrometerPanel';
import { FlightDynamicsChart } from './components/FlightDynamicsChart';
import { TelemetryTerminal } from './components/TelemetryTerminal';
import { LinkToastAlert } from './components/LinkToastAlert';

export const App: React.FC = () => {
  const {
    telemetry,
    isConnected,
    logs,
    linkAlert,
    clearLogs,
    closeLinkAlert,
  } = useTelemetry();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: '#060b13',
          backgroundImage: `
            radial-gradient(circle at 50% 0%, rgba(0, 240, 255, 0.05) 0%, transparent 60%),
            radial-gradient(circle at 100% 100%, rgba(0, 255, 136, 0.03) 0%, transparent 50%)
          `,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top HUD Header */}
        <HeaderHud telemetry={telemetry} isConnected={isConnected} />

        {/* Main Dashboard Grid */}
        <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, flexGrow: 1 }}>
          <Grid container spacing={2}>
            {/* 1. Left: 3D Attitude & Orientation */}
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <AttitudeVisualizer mpu={telemetry.mpu} />
            </Grid>

            {/* 2. Center: GPS Ground Track Map */}
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <GpsTracker gps={telemetry.gps} />
            </Grid>

            {/* 3. Right: Environmental & Radiometry Sensors */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <AtmosphericPanel bmp={telemetry.bmp} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <ThermalRadiometerPanel mlx={telemetry.mlx} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <SpectrometerPanel spec={telemetry.spec} />
                </Grid>
              </Grid>
            </Grid>

            {/* 4. Bottom Left: Real-time Trends Chart */}
            <Grid size={{ xs: 12, lg: 7 }}>
              <FlightDynamicsChart telemetry={telemetry} />
            </Grid>

            {/* 5. Bottom Right: LoRa Packet Terminal Log */}
            <Grid size={{ xs: 12, lg: 5 }}>
              <TelemetryTerminal logs={logs} onClear={clearLogs} />
            </Grid>
          </Grid>
        </Box>

        {/* RF Link Event Toast Notification */}
        <LinkToastAlert
          open={linkAlert.open}
          message={linkAlert.message}
          onClose={closeLinkAlert}
        />
      </Box>
    </ThemeProvider>
  );
};

export default App;
