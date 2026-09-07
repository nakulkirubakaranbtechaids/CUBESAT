import http.server
import socketserver
import threading
import time
import json
import re
import os
import sys

# Ensure UTF-8 output encoding on Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

try:
    import serial
except ImportError:
    serial = None

PORT = 8080
# Set to 'AUTO' to auto-detect the first available ESP32/CP210x port,
# or set to a specific port like 'COM4' for the ground station receiver.
SERIAL_PORT = 'AUTO'
BAUD_RATE = 115200

# Global latest state
latest_telemetry = {
    "connected": False,
    "packet": 0,
    "raw": "Waiting for telemetry...",
    "timestamp": time.time(),
    "mpu": {"ax": 0.0, "ay": 0.0, "az": 9.8, "gx": 0.0, "gy": 0.0, "gz": 0.0},
    "bmp": {"temp": 0.0, "pressure": 1013.25, "altitude": 0.0},
    "mlx": {"ambient": 0.0, "object": 0.0},
    "spec": {"raw": 0, "voltage": 0.0, "intensity": 0.0},
    "gps": {"lat": 12.9602, "lng": 79.1384, "alt": 0.0, "sats": 0},
    "lora": {"status": "STANDBY", "rssi": 0, "snr": 0.0, "gs_packets": 0}
}

telemetry_lock = threading.Lock()
subscribers = []
subscribers_lock = threading.Lock()

# Regex: match core packet (supports optional SPEC spectrometer field)
PKT_REGEX = re.compile(
    r'PKT:(\d+),A:([^,]+),G:([^,]+),T:([^,]+),P:([^,]+),H:([^,]+),IR:([^,]+)'
)
GPS_REGEX = re.compile(r'GPS:([^,]+),SAT:(\d+)')
SPEC_REGEX = re.compile(r'SPEC:([\d.]+)/([\d.]+)')
RF_LINK_REGEX = re.compile(r'RSSI:(-?\d+),SNR:([\d.\-]+),GS_PKT:(\d+)')

def auto_detect_port():
    """Scan available serial ports and return first CP210x / CH340 / FTDI device."""
    try:
        from serial.tools import list_ports
        ports = list(list_ports.comports())
        # Prioritize Silicon Labs CP210x (most ESP32 devkits)
        for p in ports:
            desc = (p.description or '').lower()
            if any(k in desc for k in ['cp210', 'ch340', 'ch341', 'ftdi', 'uart bridge']):
                print(f"[Auto-detect] Found ESP32 on {p.device}: {p.description}")
                return p.device
        # Fallback: return first available port
        if ports:
            print(f"[Auto-detect] Fallback to first port: {ports[0].device}")
            return ports[0].device
    except Exception as e:
        print(f"[Auto-detect] Error: {e}")
    return 'COM3'

def parse_telemetry_line(line_str):
    global latest_telemetry
    match = PKT_REGEX.search(line_str)
    if not match:
        return None
    
    try:
        pkt_num = int(match.group(1))
        
        ax, ay, az = [float(v) for v in match.group(2).split('/')]
        gx, gy, gz = [float(v) for v in match.group(3).split('/')]
        
        bmp_t = float(match.group(4))
        bmp_p = float(match.group(5))
        bmp_h = float(match.group(6))
        
        mlx_amb, mlx_obj = [float(v) for v in match.group(7).split('/')]

        # Parse GPS
        lat, lng, gps_alt, sats = 0.0, 0.0, 0.0, 0
        gps_match = GPS_REGEX.search(line_str)
        if gps_match:
            lat, lng, gps_alt = [float(v) for v in gps_match.group(1).split('/')]
            sats = int(gps_match.group(2))

        # Parse Spectrometer (GPIO 34)
        spec_data = {"raw": 0, "voltage": 0.0, "intensity": 0.0}
        spec_match = SPEC_REGEX.search(line_str)
        if spec_match:
            s_raw = int(float(spec_match.group(1)))
            s_pct = float(spec_match.group(2))
            s_v = round((s_raw / 4095.0) * 3.3, 2)
            spec_data = {
                "raw": s_raw,
                "voltage": s_v,
                "intensity": round(s_pct, 1)
            }
        
        data = {
            "connected": True,
            "packet": pkt_num,
            "raw": line_str.strip(),
            "timestamp": time.time(),
            "mpu": {
                "ax": round(ax, 2), "ay": round(ay, 2), "az": round(az, 2),
                "gx": round(gx, 2), "gy": round(gy, 2), "gz": round(gz, 2)
            },
            "bmp": {
                "temp": round(bmp_t, 2),
                "pressure": round(bmp_p, 2),
                "altitude": round(bmp_h, 2)
            },
            "mlx": {
                "ambient": round(mlx_amb, 2),
                "object": round(mlx_obj, 2)
            },
            "spec": spec_data,
            "gps": {
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "alt": round(gps_alt, 1),
                "sats": sats
            },
            "lora": {"status": "RECEIVED_LORA", "rssi": 0, "snr": 0.0, "gs_packets": 0}
        }

        # Parse optional RF link quality fields (ground station mode)
        rf_match = RF_LINK_REGEX.search(line_str)
        if rf_match:
            rssi = int(rf_match.group(1))
            snr  = float(rf_match.group(2))
            gs_pkt = int(rf_match.group(3))
            data["lora"] = {
                "status": "RECEIVED_LORA",
                "rssi": rssi,
                "snr":  round(snr, 1),
                "gs_packets": gs_pkt
            }
        
        with telemetry_lock:
            latest_telemetry = data
            
        print(f"[Telemetry #{pkt_num}] Alt: {bmp_h:.1f}m | Temp: {bmp_t:.1f}C | Spec: {spec_data['intensity']}% ({spec_data['voltage']}V) | Sats: {sats}")

        # Dispatch to all active SSE subscribers
        payload = f"data: {json.dumps(data)}\n\n".encode('utf-8')
        with subscribers_lock:
            dead_subs = []
            for sub in subscribers:
                try:
                    sub.write(payload)
                    sub.flush()
                except Exception:
                    dead_subs.append(sub)
            for d in dead_subs:
                subscribers.remove(d)
                
        return data
    except Exception as e:
        print(f"[Parser Error] {e} on line: {line_str}")
        return None

def serial_reader_thread():
    global latest_telemetry
    
    while True:
        ser = None
        try:
            if not serial:
                print("[Serial Error] PySerial not installed. Please run: pip install pyserial")
                time.sleep(3)
                continue

            # Resolve port — auto-detect if configured
            port = auto_detect_port() if SERIAL_PORT == 'AUTO' else SERIAL_PORT
            print(f"[Serial] Attempting connection to {port} @ {BAUD_RATE} baud...")

            ser = serial.Serial(port, BAUD_RATE, timeout=2)
            print(f"[Serial] Successfully connected to {port}!")
            print(f"[Serial] Listening for live ESP32 hardware telemetry...\n")

            with telemetry_lock:
                latest_telemetry["connected"] = True
                
            while True:
                line = ser.readline()
                if not line:
                    continue
                try:
                    decoded = line.decode('utf-8', errors='ignore').strip()
                    if decoded:
                        if "LINK_ESTABLISHED" in decoded or "HELLO" in decoded:
                            print(f"\n=======================================================")
                            print(f"  🚀 RF LINK ESTABLISHED: {decoded}")
                            print(f"=======================================================\n")
                            # Send link alert event to web dashboard
                            alert_payload = f"data: {json.dumps({'link_event': decoded, 'timestamp': time.time()})}\n\n".encode('utf-8')
                            with subscribers_lock:
                                for sub in subscribers:
                                    try:
                                        sub.write(alert_payload)
                                        sub.flush()
                                    except Exception:
                                        pass
                        else:
                            print(f"[ESP32 Output] {decoded}")
                        parse_telemetry_line(decoded)
                except Exception as e:
                    print(f"[Decode error] {e}")

        except serial.SerialException as se:
            with telemetry_lock:
                latest_telemetry["connected"] = False
            print(f"[Serial Error] {se}")
            print(f"[Tip] If port is busy, ensure Arduino IDE Serial Monitor or other serial terminals are closed.\n")
            time.sleep(3)
        except Exception as ex:
            with telemetry_lock:
                latest_telemetry["connected"] = False
            print(f"[Unexpected Error] {ex}. Retrying in 3 seconds...")
            time.sleep(3)
        finally:
            if ser and ser.is_open:
                try:
                    ser.close()
                except Exception:
                    pass

class TelemetryHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        if self.path == '/api/latest':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with telemetry_lock:
                data = json.dumps(latest_telemetry)
            self.wfile.write(data.encode('utf-8'))
            return
            
        elif self.path == '/api/stream':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Send current state immediately
            with telemetry_lock:
                init_data = f"data: {json.dumps(latest_telemetry)}\n\n".encode('utf-8')
            try:
                self.wfile.write(init_data)
                self.wfile.flush()
            except Exception:
                return
                
            with subscribers_lock:
                subscribers.append(self.wfile)
                
            # Keep the connection open until client disconnects
            try:
                while True:
                    time.sleep(1)
            except Exception:
                with subscribers_lock:
                    if self.wfile in subscribers:
                        subscribers.remove(self.wfile)
            return
            
        # Default static file serving (index.html, style.css, app.js)
        return super().do_GET()

    def log_message(self, format, *args):
        # Suppress standard noisy HTTP request logging in terminal
        pass

import socket

UDP_PORT = 8888

def udp_reader_thread():
    """Listens for Ground Station telemetry packets sent over WiFi UDP broadcast."""
    global latest_telemetry
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("", UDP_PORT))
        print(f"[WiFi] Ground Station UDP listener active on port {UDP_PORT}")
    except Exception as e:
        print(f"[WiFi Error] Failed to bind UDP port {UDP_PORT}: {e}")
        return

    while True:
        try:
            data, addr = sock.recvfrom(2048)
            if data:
                line = data.decode('utf-8', errors='ignore').strip()
                if "LINK_ESTABLISHED" in line or "HELLO" in line:
                    print(f"\n=======================================================")
                    print(f"  🚀 RF LINK ESTABLISHED (via WiFi from {addr[0]}): {line}")
                    print(f"=======================================================\n")
                    alert_payload = f"data: {json.dumps({'link_event': line, 'timestamp': time.time(), 'source': f'WiFi ({addr[0]})'})}\n\n".encode('utf-8')
                    with subscribers_lock:
                        for sub in subscribers:
                            try:
                                sub.write(alert_payload)
                                sub.flush()
                            except Exception:
                                pass
                else:
                    print(f"[WiFi IN from {addr[0]}] {line}")
                
                parsed = parse_telemetry_line(line)
                if parsed:
                    with telemetry_lock:
                        latest_telemetry["source"] = f"WiFi ({addr[0]})"
        except Exception as e:
            print(f"[WiFi Read Error] {e}")
            time.sleep(1)

def main():
    global PORT, SERIAL_PORT
    import argparse
    parser = argparse.ArgumentParser(description="CubeSat Mission Control Server (WiFi + USB Dual-Link)")
    parser.add_argument("--port", type=int, default=PORT, help=f"HTTP port (default: {PORT})")
    parser.add_argument("--serial-port", type=str, default=SERIAL_PORT, help="Serial COM port (default: AUTO or e.g. COM3)")
    args = parser.parse_args()

    PORT = args.port
    SERIAL_PORT = args.serial_port

    # 1. Start WiFi UDP background receiver
    t_udp = threading.Thread(target=udp_reader_thread, daemon=True)
    t_udp.start()

    # 2. Start serial background receiver
    t_ser = threading.Thread(target=serial_reader_thread, daemon=True)
    t_ser.start()
    
    # 3. Start HTTP server
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), TelemetryHandler) as httpd:
        print("=======================================================")
        print("   CubeSat Mission Control - WIFI + USB DUAL-LINK       ")
        print(f"   👉 Web Dashboard URL: http://localhost:{PORT}")
        print(f"   WiFi Ingest: UDP Port {UDP_PORT}")
        print(f"   Serial Ingest: {SERIAL_PORT} @ {BAUD_RATE} baud")
        print("=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == '__main__':
    main()
