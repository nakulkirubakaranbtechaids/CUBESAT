import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Grid,
} from '@mui/material';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import type { BmpData } from '../types/telemetry';


interface AtmosphericPanelProps {
  bmp: BmpData;
}

export const AtmosphericPanel: React.FC<AtmosphericPanelProps> = ({ bmp }) => {
  const altPercent = Math.min(100, Math.max(5, (bmp.altitude / 1000) * 100));
  const pressPercent = Math.min(100, Math.max(5, ((bmp.pressure - 800) / 300) * 100));
  const tempPercent = Math.min(100, Math.max(5, ((bmp.temp + 10) / 60) * 100));

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={<CloudQueueIcon sx={{ color: '#00f0ff' }} />}
        title="ATMOSPHERIC METRICS (BMP-280)"
        action={
          <Chip
            label="I2C: 0x76"
            size="small"
            variant="outlined"
            sx={{ color: '#00f0ff', borderColor: '#00f0ff' }}
          />
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          {/* Barometric Altitude */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 1,
                border: '1px solid rgba(0, 240, 255, 0.1)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
                BAROMETRIC ALTITUDE
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 0.5 }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    color: '#00f0ff',
                  }}
                >
                  {bmp.altitude.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  m
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={altPercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(0, 240, 255, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#00f0ff',
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          </Grid>

          {/* Air Pressure */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 1,
                border: '1px solid rgba(0, 255, 136, 0.1)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
                AIR PRESSURE
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 0.5 }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    color: '#00ff88',
                  }}
                >
                  {bmp.pressure.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  hPa
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pressPercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(0, 255, 136, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#00ff88',
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          </Grid>

          {/* BMP Temp */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 1,
                border: '1px solid rgba(255, 183, 0, 0.1)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
                BMP TEMPERATURE
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 0.5 }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    color: '#ffb700',
                  }}
                >
                  {bmp.temp.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  °C
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={tempPercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 183, 0, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#ffb700',
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
