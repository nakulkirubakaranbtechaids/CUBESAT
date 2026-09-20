import axios from 'axios';
import type { TelemetryPacket } from '../types/telemetry';


const apiClient = axios.create({
  baseURL: '',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchLatestTelemetry = async (): Promise<TelemetryPacket> => {
  const response = await apiClient.get<TelemetryPacket>('/api/latest');
  return response.data;
};

export const getStreamUrl = (): string => {
  return '/api/stream';
};

export const downloadTelemetryCsv = async (): Promise<void> => {
  const response = await apiClient.get('/api/download_csv', {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'telemetry_log.csv');
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default apiClient;

