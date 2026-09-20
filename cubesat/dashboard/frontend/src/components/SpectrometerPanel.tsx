import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import FlareIcon from '@mui/icons-material/Flare';
import type { SpecData } from '../types/telemetry';


interface SpectrometerPanelProps {
  spec: SpecData;
}

export const SpectrometerPanel: React.FC<SpectrometerPanelProps> = ({ spec }) => {
  const intensity = spec.intensity || 0;
  const raw = spec.raw || 0;
  const voltage = spec.voltage || 0;

  let statusText = 'LOW / SHADOW';
  let statusColor: 'info' | 'success' | 'error' = 'info';
  if (intensity > 70) {
    statusText = 'HIGH IR FLUX';
    statusColor = 'error';
  } else if (intensity > 25) {
    statusText = 'DIFFUSE AMBIENT';
    statusColor = 'success';
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={<FlareIcon sx={{ color: '#e056fd' }} />}
        title="ANALOG IR SPECTROMETER (GPIO 34)"
        action={
          <Chip
            label="ADC1: 12-Bit"
            size="small"
            variant="outlined"
            sx={{ color: '#e056fd', borderColor: '#e056fd' }}
          />
        }
      />
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Radiance Index Bar */}
        <Box
          sx={{
            p: 1.5,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: 1,
            border: '1px solid rgba(224, 86, 253, 0.15)',
          }}
        >
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
            SPECTRAL RADIANCE INDEX
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 0.5 }}>
            <Typography
              variant="h3"
              sx={{
                fontFamily: 'JetBrains Mono',
                fontWeight: 700,
                fontSize: '1.4rem',
                color: '#e056fd',
              }}
            >
              {intensity.toFixed(1)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              %
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(5, intensity))}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(224, 86, 253, 0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#e056fd',
                borderRadius: 3,
              },
            }}
          />
        </Box>

        {/* Readout Details */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: '8px 12px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: 1,
            border: '1px solid rgba(224, 86, 253, 0.1)',
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem' }}>
              RAW ADC:
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#00f0ff' }}
            >
              {raw}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem' }}>
              VOLTAGE:
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#00ff88' }}
            >
              {voltage.toFixed(2)} V
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem' }}>
              STATUS:
            </Typography>
            <Chip label={statusText} size="small" color={statusColor} sx={{ height: 20, fontSize: '0.65rem' }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
