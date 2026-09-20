import React, { useEffect, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { TelemetryPacket } from '../types/telemetry';


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface FlightDynamicsChartProps {
  telemetry: TelemetryPacket;
}

const MAX_POINTS = 30;

export const FlightDynamicsChart: React.FC<FlightDynamicsChartProps> = ({ telemetry }) => {
  const chartDataRef = useRef<{
    labels: string[];
    altitude: number[];
    bmpTemp: number[];
    mlxTemp: number[];
  }>({
    labels: [],
    altitude: [],
    bmpTemp: [],
    mlxTemp: [],
  });

  useEffect(() => {
    if (!telemetry || telemetry.packet === 0) return;

    const { labels, altitude, bmpTemp, mlxTemp } = chartDataRef.current;
    const label = '#' + telemetry.packet;

    // Avoid duplicate insertions if same packet arrives
    if (labels.length > 0 && labels[labels.length - 1] === label) return;

    labels.push(label);
    altitude.push(telemetry.bmp.altitude);
    bmpTemp.push(telemetry.bmp.temp);
    mlxTemp.push(telemetry.mlx.object);

    if (labels.length > MAX_POINTS) {
      labels.shift();
      altitude.shift();
      bmpTemp.shift();
      mlxTemp.shift();
    }
  }, [telemetry]);

  const data = {
    labels: chartDataRef.current.labels,
    datasets: [
      {
        label: 'BMP280 Altitude (m)',
        data: chartDataRef.current.altitude,
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.08)',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.35,
        yAxisID: 'yAlt',
        fill: true,
      },
      {
        label: 'BMP280 Temp (°C)',
        data: chartDataRef.current.bmpTemp,
        borderColor: '#ffb700',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.35,
        yAxisID: 'yTemp',
      },
      {
        label: 'MLX90614 Target Temp (°C)',
        data: chartDataRef.current.mlxTemp,
        borderColor: '#ff3366',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.35,
        yAxisID: 'yTemp',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(11, 19, 32, 0.95)',
        borderColor: 'rgba(0, 240, 255, 0.3)',
        borderWidth: 1,
        titleFont: { family: 'Orbitron', size: 11 },
        bodyFont: { family: 'JetBrains Mono', size: 10 },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 } },
      },
      yAlt: {
        type: 'linear' as const,
        position: 'left' as const,
        grid: { color: 'rgba(0, 240, 255, 0.06)' },
        ticks: { color: '#00f0ff', font: { family: 'JetBrains Mono', size: 9 } },
        title: { display: true, text: 'Altitude (m)', color: '#00f0ff', font: { size: 10 } },
      },
      yTemp: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: '#ffb700', font: { family: 'JetBrains Mono', size: 9 } },
        title: { display: true, text: 'Temp (°C)', color: '#ffb700', font: { size: 10 } },
      },
    },
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={<ShowChartIcon sx={{ color: '#00f0ff' }} />}
        title="FLIGHT DYNAMICS & THERMAL TRENDS"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00f0ff' }} />
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>
                Altitude (m)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ffb700' }} />
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>
                BMP Temp (°C)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff3366' }} />
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>
                IR Target (°C)
              </Typography>
            </Box>
          </Box>
        }
      />
      <CardContent sx={{ height: 200 }}>
        <Line data={data} options={options} />
      </CardContent>
    </Card>
  );
};
