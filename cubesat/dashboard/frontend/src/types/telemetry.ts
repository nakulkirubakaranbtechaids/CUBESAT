export interface MpuData {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface BmpData {
  temp: number;
  pressure: number;
  altitude: number;
}

export interface MlxData {
  ambient: number;
  object: number;
}

export interface SpecData {
  raw: number;
  voltage: number;
  intensity: number;
}

export interface GpsData {
  lat: number;
  lng: number;
  alt: number;
  sats: number;
  speed?: number;
}

export interface LoraData {
  status: string;
  rssi: number;
  snr: number;
  gs_packets: number;
}

export interface TelemetryPacket {
  connected: boolean;
  packet: number;
  raw: string;
  timestamp: number;
  mpu: MpuData;
  bmp: BmpData;
  mlx: MlxData;
  spec: SpecData;
  gps: GpsData;
  lora: LoraData;
  source?: string;
  link_event?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  type: 'telemetry' | 'info' | 'warning' | 'alert';
}
