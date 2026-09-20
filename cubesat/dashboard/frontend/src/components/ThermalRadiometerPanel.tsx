import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Chip,
  Grid,
} from '@mui/material';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import type { MlxData } from '../types/telemetry';


interface ThermalRadiometerPanelProps {
  mlx: MlxData;
}

export const ThermalRadiometerPanel: React.FC<ThermalRadiometerPanelProps> = ({ mlx }) => {
  const deltaT = mlx.object - mlx.ambient;

  let deltaColor = '#00f0ff';
  let deltaStatus = 'THERMAL EQUILIBRIUM';
  if (Math.abs(deltaT) < 1.0) {
    deltaColor = '#00f0ff';
    deltaStatus = 'EQUILIBRIUM';
  } else if (deltaT > 0) {
    deltaColor = '#ff3366';
    deltaStatus = 'TARGET RADIATING HEAT';
  } else {
    deltaColor = '#00ff88';
    deltaStatus = 'TARGET ABSORBING HEAT';
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={<DeviceThermostatIcon sx={{ color: '#ff3366' }} />}
        title="INFRARED THERMAL RADIOMETER (MLX-90614)"
        action={
          <Chip
            label="I2C: 0x5A"
            size="small"
            variant="outlined"
            sx={{ color: '#ff3366', borderColor: '#ff3366' }}
          />
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          {/* Target / Object Temp */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 1,
                border: '1px solid rgba(255, 51, 102, 0.15)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
                TARGET / OBJECT TEMP
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 0.5 }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    color: '#ff3366',
                  }}
                >
                  {mlx.object.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  °C
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.62rem' }}>
                Contactless IR Target Surface
              </Typography>
            </Box>
          </Grid>

          {/* Ambient Die Temp */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 1,
                border: '1px solid rgba(0, 240, 255, 0.15)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
                AMBIENT DIE TEMP
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
                  {mlx.ambient.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  °C
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.62rem' }}>
                Internal Sensor Temperature
              </Typography>
            </Box>
          </Grid>

          {/* Thermal Gradient (Delta T) */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 1,
                border: `1px solid ${deltaColor}33`,
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
                THERMAL GRADIENT (ΔT)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 0.5 }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    color: deltaColor,
                  }}
                >
                  {(deltaT >= 0 ? '+' : '') + deltaT.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  °C
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{ color: deltaColor, fontWeight: 700, fontSize: '0.62rem' }}
              >
                {deltaStatus}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
