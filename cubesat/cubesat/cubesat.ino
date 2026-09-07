#include <Wire.h>
#include <SPI.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_MLX90614.h>
#include <LoRa.h>
#include <TinyGPSPlus.h>

// ==========================================
// PIN DEFINITIONS
// ==========================================
// I2C Pins (Shared between MPU6050, BMP280, MLX90614)
#define I2C_SDA 21
#define I2C_SCL 22

// LoRa SX1278 (SPI) Pins
#define LORA_SCK  18
#define LORA_MISO 19
#define LORA_MOSI 23
#define LORA_SS   5
#define LORA_RST  14
#define LORA_DIO0 26
#define LORA_BAND 433E6 // Change to 868E6 or 915E6 according to your LoRa module frequency

// GPS NEO-6M (Hardware Serial2) Pins
#define GPS_RX_PIN 16 // Connect to GPS TX
#define GPS_TX_PIN 17 // Connect to GPS RX
#define GPS_BAUD   9600

// ==========================================
// SENSOR OBJECTS & STATUS FLAGS
// ==========================================
Adafruit_MPU6050 mpu;
Adafruit_BMP280  bmp;
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

bool mpu_ok  = false;
bool bmp_ok  = false;
bool mlx_ok  = false;
bool lora_ok = false;

unsigned long packetCounter = 0;
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 1000; // Send telemetry every 1 second

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==========================================");
  Serial.println("   ESP32 CubeSat Telemetry Node Booting   ");
  Serial.println("==========================================");

  // 1. Initialize I2C Bus at 100kHz (Required for MLX90614 SMBus compatibility)
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);
  Serial.println("[I2C] Initialized on SDA: GPIO 21, SCL: GPIO 22 @ 100kHz");

  // 2. Initialize MPU6050
  Serial.print("[MPU6050] Initializing... ");
  if (mpu.begin(0x68, &Wire)) {
    mpu_ok = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("SUCCESS (Address: 0x68)");
  } else {
    Serial.println("FAILED! (Check wiring or AD0 pin)");
  }

  // 3. Initialize BMP280
  Serial.print("[BMP280] Initializing... ");
  // Try default 0x76, fallback to 0x77
  if (bmp.begin(0x76)) {
    bmp_ok = true;
    Serial.println("SUCCESS (Address: 0x76)");
  } else if (bmp.begin(0x77)) {
    bmp_ok = true;
    Serial.println("SUCCESS (Address: 0x77)");
  } else {
    Serial.println("FAILED! (Check wiring/SDO pin)");
  }

  // 4. Initialize MLX90614
  Serial.print("[MLX90614] Initializing... ");
  if (mlx.begin(0x5A, &Wire)) {
    mlx_ok = true;
    Serial.println("SUCCESS (Address: 0x5A)");
  } else {
    Serial.println("FAILED! (Check wiring/power)");
  }

  // 5. Initialize GPS Serial
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[GPS] NEO-6M Serial2 started on RX: GPIO 16, TX: GPIO 17 @ 9600 baud");

  // 6. Initialize LoRa Module
  Serial.print("[LoRa] Initializing SPI & SX1278... ");
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (LoRa.begin(LORA_BAND)) {
    lora_ok = true;
    LoRa.setTxPower(17); // 17 dBm (configurable 2-20)
    LoRa.setSpreadingFactor(7);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
    Serial.println("SUCCESS");

    // Broadcast initial HELLO handshake message to Ground Station
    delay(250);
    LoRa.beginPacket();
    LoRa.print("HELLO:CUBESAT-1_ONLINE");
    LoRa.endPacket();
    Serial.println("[LoRa] Sent HELLO handshake packet to Ground Station!");
  } else {
    Serial.println("FAILED! (Check SPI wiring / power / 3.3V)");
  }

  Serial.println("\nInitialization complete! Starting telemetry loop...\n");
}

void loop() {
  // Feed incoming NMEA sentences from GPS
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Check telemetry broadcast timer
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = millis();
    packetCounter++;

    // ----------------------------------------------------
    // Read MPU6050 IMU Data
    // ----------------------------------------------------
    float ax = 0, ay = 0, az = 0;
    float gx = 0, gy = 0, gz = 0;
    if (mpu_ok) {
      sensors_event_t a, g, temp;
      mpu.getEvent(&a, &g, &temp);
      ax = a.acceleration.x;
      ay = a.acceleration.y;
      az = a.acceleration.z;
      gx = g.gyro.x;
      gy = g.gyro.y;
      gz = g.gyro.z;
    }

    // ----------------------------------------------------
    // Read BMP280 Environmental Data
    // ----------------------------------------------------
    float bmp_temp = 0;
    float bmp_press = 0;
    float bmp_alt = 0;
    if (bmp_ok) {
      bmp_temp  = bmp.readTemperature();
      bmp_press = bmp.readPressure() / 100.0F; // Convert Pa to hPa
      bmp_alt   = bmp.readAltitude(1013.25);   // Altitude using standard sea-level pressure
    }

    // ----------------------------------------------------
    // Read MLX90614 Infrared Temp Data
    // ----------------------------------------------------
    double amb_temp = 0;
    double obj_temp = 0;
    if (mlx_ok) {
      amb_temp = mlx.readAmbientTempC();
      obj_temp = mlx.readObjectTempC();
    }

    // ----------------------------------------------------
    // Read GPS Data & Diagnostics
    // ----------------------------------------------------
    double lat = gps.location.isValid() ? gps.location.lat() : 0.0;
    double lng = gps.location.isValid() ? gps.location.lng() : 0.0;
    double gps_alt = gps.altitude.isValid() ? gps.altitude.meters() : 0.0;
    double speed_kmph = gps.speed.isValid() ? gps.speed.kmph() : 0.0;
    int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
    unsigned long chars = gps.charsProcessed();
    unsigned long fixes = gps.sentencesWithFix();
    unsigned long failed = gps.failedChecksum();

    // ----------------------------------------------------
    // Construct Compact CSV Telemetry Packet
    // Format: PKT,COUNT,AX,AY,AZ,GX,GY,GZ,BMP_T,PRESS,ALT,AMB_T,OBJ_T,LAT,LNG,GPS_ALT,SATS
    // ----------------------------------------------------
    char packet[256];
    snprintf(packet, sizeof(packet),
      "PKT:%lu,A:%.2f/%.2f/%.2f,G:%.2f/%.2f/%.2f,T:%.1f,P:%.1f,H:%.1f,IR:%.1f/%.1f,GPS:%.6f/%.6f/%.1f,SAT:%d",
      packetCounter,
      ax, ay, az,
      gx, gy, gz,
      bmp_temp, bmp_press, bmp_alt,
      amb_temp, obj_temp,
      lat, lng, gps_alt, sats
    );

    // ----------------------------------------------------
    // Broadcast via LoRa
    // ----------------------------------------------------
    if (lora_ok) {
      LoRa.beginPacket();
      LoRa.print(packet);
      LoRa.endPacket();
    }

    // ----------------------------------------------------
    // Print to Serial Monitor for Real-time Debugging
    // ----------------------------------------------------
    Serial.println("--------------------------------------------------------------------------------");
    Serial.printf("[PKT #%lu] %s\n", packetCounter, packet);
    Serial.printf("  IMU (m/s^2)  : Accel [X: %.2f, Y: %.2f, Z: %.2f] | Gyro [X: %.2f, Y: %.2f, Z: %.2f]\n", ax, ay, az, gx, gy, gz);
    Serial.printf("  BMP280       : Temp: %.2f C | Press: %.2f hPa | Alt: %.2f m\n", bmp_temp, bmp_press, bmp_alt);
    Serial.printf("  MLX90614     : Ambient: %.2f C | Object (Target): %.2f C\n", amb_temp, obj_temp);
    Serial.printf("  GPS NEO-6M   : Lat: %.6f | Lon: %.6f | Alt: %.1f m | Speed: %.1f km/h | Sats: %d\n", lat, lng, gps_alt, speed_kmph, sats);
    Serial.printf("  GPS Diag     : NMEA Chars: %lu | Fix Sentences: %lu | Checksum Err: %lu\n", chars, fixes, failed);
    if (chars == 0) {
      Serial.println("  [GPS WARNING]: 0 characters received from GPS! Verify GPS TX -> ESP32 GPIO 16 & 5V VCC.");
    } else if (sats == 0) {
      Serial.println("  [GPS STATUS] : NMEA stream active, but searching for satellites... (Move near window/sky).");
    }
    Serial.printf("  LoRa Status  : %s\n", lora_ok ? "TRANSMITTED" : "OFFLINE");
  }
}
