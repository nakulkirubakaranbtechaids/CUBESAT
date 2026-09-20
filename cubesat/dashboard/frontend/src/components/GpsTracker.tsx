import React, { useEffect, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Chip,
  Grid,
} from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import * as L from 'leaflet';
import type { GpsData } from '../types/telemetry';


interface GpsTrackerProps {
  gps: GpsData;
}

export const GpsTracker: React.FC<GpsTrackerProps> = ({ gps }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const trackHistoryRef = useRef<L.LatLng[]>([]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: 'abc',
    }).addTo(map);

    const polyline = L.polyline([], {
      color: '#00f0ff',
      weight: 3,
      opacity: 0.85,
      dashArray: '4, 6',
    }).addTo(map);

    mapRef.current = map;
    polylineRef.current = polyline;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update marker and trajectory when GPS location arrives
  useEffect(() => {
    if (!mapRef.current) return;
    const { lat, lng } = gps;

    if (lat === 0 && lng === 0) return;

    const newLatLng = new L.LatLng(lat, lng);

    if (!markerRef.current) {
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
        iconAnchor: [7, 7],
      });

      const marker = L.marker(newLatLng, { icon: satIcon }).addTo(mapRef.current);
      marker.bindPopup("<b style='color:#000;'>CubeSat-1</b><br>Ground Track Location");
      mapRef.current.setView(newLatLng, 15);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(newLatLng);
      mapRef.current.panTo(newLatLng);
    }

    trackHistoryRef.current.push(newLatLng);
    if (trackHistoryRef.current.length > 200) {
      trackHistoryRef.current.shift();
    }

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(trackHistoryRef.current);
    }
  }, [gps]);

  const hasFix = gps.sats > 0 && (gps.lat !== 0 || gps.lng !== 0);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        avatar={<NavigationIcon sx={{ color: '#00ff88' }} />}
        title="GROUND TRACK & NAVIGATION (NEO-6M GPS)"
        action={
          <Chip
            icon={<SatelliteAltIcon sx={{ fontSize: 14, color: hasFix ? '#00ff88' : '#ffb700' }} />}
            label={`SATS: ${gps.sats}`}
            size="small"
            color={hasFix ? 'success' : 'warning'}
            variant="outlined"
          />
        }
      />
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Map Container */}
        <Box
          sx={{
            height: 220,
            width: '100%',
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid rgba(0, 240, 255, 0.15)',
            position: 'relative',
            '& .leaflet-tile': {
              filter: 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)',
            },
            '& .leaflet-container': {
              backgroundColor: '#060b13',
            },
          }}
        >
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </Box>

        {/* GPS Telemetry Strip */}
        <Grid container spacing={1}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Box sx={{ p: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem' }}>
                LATITUDE
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: hasFix ? '#00f0ff' : '#ffb700',
                }}
              >
                {hasFix ? `${gps.lat.toFixed(6)}°` : 'SEARCHING...'}
              </Typography>
            </Box>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Box sx={{ p: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem' }}>
                LONGITUDE
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: hasFix ? '#00f0ff' : '#94a3b8',
                }}
              >
                {hasFix ? `${gps.lng.toFixed(6)}°` : 'NO FIX'}
              </Typography>
            </Box>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Box sx={{ p: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem' }}>
                GPS ALTITUDE
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: '#00f0ff',
                }}
              >
                {hasFix ? `${gps.alt.toFixed(1)} m` : 'WAITING'}
              </Typography>
            </Box>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Box sx={{ p: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.62rem' }}>
                GROUND SPEED
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: '#00ff88',
                }}
              >
                {hasFix ? `${(gps.speed || 0).toFixed(1)} km/h` : '0.0 km/h'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
