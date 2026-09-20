import { useState, useEffect, useCallback, useRef } from 'react';
import type { TelemetryPacket, LogEntry } from '../types/telemetry';

import { fetchLatestTelemetry, getStreamUrl } from '../services/api';

const INITIAL_TELEMETRY: TelemetryPacket = {
  connected: false,
  packet: 0,
  raw: 'Waiting for telemetry link...',
  timestamp: Date.now() / 1000,
  mpu: { ax: 0.0, ay: 0.0, az: 9.8, gx: 0.0, gy: 0.0, gz: 0.0 },
  bmp: { temp: 0.0, pressure: 1013.25, altitude: 0.0 },
  mlx: { ambient: 0.0, object: 0.0 },
  spec: { raw: 0, voltage: 0.0, intensity: 0.0 },
  gps: { lat: 0.0, lng: 0.0, alt: 0.0, sats: 0, speed: 0.0 },
  lora: { status: 'STANDBY', rssi: 0, snr: 0.0, gs_packets: 0 },
};

export const useTelemetry = () => {
  const [telemetry, setTelemetry] = useState<TelemetryPacket>(INITIAL_TELEMETRY);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      text: '[SYSTEM] Initializing Mission Control Ground Station link...',
      type: 'info',
    },
  ]);
  const [linkAlert, setLinkAlert] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const evtSourceRef = useRef<EventSource | null>(null);

  const addLog = useCallback((text: string, type: 'telemetry' | 'info' | 'warning' | 'alert' = 'info') => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      text,
      type,
    };
    setLogs((prev) => [...prev.slice(-99), newEntry]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        text: '[SYSTEM] Terminal log cleared.',
        type: 'info',
      },
    ]);
  }, []);

  const closeLinkAlert = useCallback(() => {
    setLinkAlert({ open: false, message: '' });
  }, []);

  useEffect(() => {
    // 1. Initial snapshot fetch via Axios
    fetchLatestTelemetry()
      .then((data) => {
        if (data && data.packet > 0) {
          setTelemetry(data);
          setIsConnected(true);
        }
      })
      .catch((err) => {
        console.warn('Initial telemetry fetch error:', err);
      });

    // 2. Setup Server-Sent Events (SSE) stream
    const connectSSE = () => {
      try {
        const streamUrl = getStreamUrl();
        const es = new EventSource(streamUrl);
        evtSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
          addLog('[LINK] Connected to Python Telemetry Stream via SSE', 'info');
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.link_event) {
              setLinkAlert({
                open: true,
                message: data.link_event,
              });
              addLog(`🚀 RF HANDSHAKE: ${data.link_event}`, 'alert');
            }

            if (data.packet !== undefined) {
              setTelemetry(data);
              setIsConnected(data.connected ?? true);
              if (data.raw) {
                addLog(`[PKT #${data.packet}] ${data.raw}`, 'telemetry');
              }
            }
          } catch (parseErr) {
            console.error('SSE packet parse error:', parseErr);
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          es.close();
          // Attempt reconnect after 3 seconds
          setTimeout(connectSSE, 3000);
        };
      } catch (e) {
        console.error('EventSource connection error:', e);
        setIsConnected(false);
        setTimeout(connectSSE, 4000);
      }
    };

    connectSSE();

    return () => {
      if (evtSourceRef.current) {
        evtSourceRef.current.close();
      }
    };
  }, [addLog]);

  return {
    telemetry,
    isConnected,
    logs,
    linkAlert,
    addLog,
    clearLogs,
    closeLinkAlert,
  };
};
