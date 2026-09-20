import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Chip,
  Paper,
} from '@mui/material';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { TelemetryPacket } from '../types/telemetry';


interface HeaderHudProps {
  telemetry: TelemetryPacket;
  isConnected: boolean;
}

export const HeaderHud: React.FC<HeaderHudProps> = ({ telemetry, isConnected }) => {
  const [utcTime, setUtcTime] = useState<string>('00:00:00 UTC');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().split(' ')[4] + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const rssi = telemetry.lora?.rssi ?? 0;
  const snr = telemetry.lora?.snr ?? 0;

  let rssiColor: 'success' | 'warning' | 'error' | 'default' = 'default';
  if (rssi !== 0) {
    if (rssi > -80) rssiColor = 'success';
    else if (rssi > -100) rssiColor = 'warning';
    else rssiColor = 'error';
  }

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: 'rgba(6, 11, 19, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          py: 1,
        }}
      >
        {/* Left: Branding & Mission Badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              position: 'relative',
              width: 14,
              height: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#00ff88' : '#ff3366',
                animation: 'pulse 1.8s infinite',
                opacity: 0.6,
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)', opacity: 0.8 },
                  '70%': { transform: 'scale(2.4)', opacity: 0 },
                  '100%': { transform: 'scale(1)', opacity: 0 },
                },
              }}
            />
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: isConnected ? '#00ff88' : '#ff3366',
                boxShadow: isConnected ? '0 0 10px #00ff88' : '0 0 10px #ff3366',
              }}
            />
          </Box>

          <Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '1rem', sm: '1.15rem' },
                color: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              CUBESAT-1 MISSION CONTROL
            </Typography>
            <Typography variant="subtitle2" sx={{ color: '#00f0ff', opacity: 0.85 }}>
              ESP32 MULTI-SENSOR AVIONICS &bull; LORA 433 MHz &bull; REAL-TIME LINK
            </Typography>
          </Box>
        </Box>

        {/* Right: Metrics HUD Cards */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.2,
          }}
        >
          {/* Serial Link */}
          <Paper
            variant="outlined"
            sx={{
              p: '6px 12px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              borderColor: isConnected ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 51, 102, 0.3)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontSize: '0.62rem', color: '#64748b' }}>
              SERIAL LINK
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2 }}>
              <Chip
                size="small"
                label={isConnected ? 'CONNECTED' : 'OFFLINE'}
                color={isConnected ? 'success' : 'error'}
                sx={{ height: 20, fontSize: '0.68rem' }}
              />
            </Box>
          </Paper>

          {/* LoRa RF Link */}
          <Paper
            variant="outlined"
            sx={{
              p: '6px 12px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              borderColor: 'rgba(0, 240, 255, 0.25)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontSize: '0.62rem', color: '#64748b' }}>
              LORA RF LINK
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
              <WifiTetheringIcon sx={{ fontSize: 16, color: '#00f0ff' }} />
              <Typography
                variant="body2"
                sx={{ color: '#00f0ff', fontWeight: 700, fontSize: '0.75rem' }}
              >
                {rssi !== 0 ? 'GS RECEIVING' : isConnected ? 'ACTIVE' : 'STANDBY'}
              </Typography>
            </Box>
          </Paper>

          {/* RSSI (dBm) */}
          <Paper
            variant="outlined"
            sx={{
              p: '6px 12px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              borderColor: 'rgba(0, 240, 255, 0.2)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontSize: '0.62rem', color: '#64748b' }}>
              RSSI (dBm)
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '0.85rem',
                color:
                  rssiColor === 'success'
                    ? '#00ff88'
                    : rssiColor === 'warning'
                    ? '#ffb700'
                    : rssiColor === 'error'
                    ? '#ff3366'
                    : '#94a3b8',
              }}
            >
              {rssi !== 0 ? `${rssi} dBm` : '--'}
            </Typography>
          </Paper>

          {/* SNR (dB) */}
          <Paper
            variant="outlined"
            sx={{
              p: '6px 12px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              borderColor: 'rgba(0, 240, 255, 0.2)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontSize: '0.62rem', color: '#64748b' }}>
              SNR (dB)
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: '#00ff88',
              }}
            >
              {snr !== 0 ? `${snr} dB` : '--'}
            </Typography>
          </Paper>

          {/* Packets Received */}
          <Paper
            variant="outlined"
            sx={{
              p: '6px 12px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              borderColor: 'rgba(0, 240, 255, 0.2)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontSize: '0.62rem', color: '#64748b' }}>
              PACKETS
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: '#f1f5f9',
              }}
            >
              #{telemetry.packet}
            </Typography>
          </Paper>

          {/* UTC Clock */}
          <Paper
            variant="outlined"
            sx={{
              p: '6px 12px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              borderColor: 'rgba(0, 255, 136, 0.3)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontSize: '0.62rem', color: '#64748b' }}>
              UTC TIME
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2 }}>
              <AccessTimeIcon sx={{ fontSize: 15, color: '#00ff88' }} />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: '#00ff88',
                }}
              >
                {utcTime}
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
