/*
 * ==========================================================================
 *  CUBESAT-1 LORA GROUND STATION RECEIVER (WIFI + SERIAL DUAL-LINK)
 *  ESP32 DevKit + LoRa SX1278 (433 MHz)
 *
 *  Role: Receives LoRa packets from CubeSat-1, decodes them, and forwards
 *        them over WiFi (UDP broadcast to PC Dashboard) AND USB Serial.
 *
 *  Wiring (same as CubeSat LoRa module):
 *    LoRa SCK  -> GPIO 18
 *    LoRa MISO -> GPIO 19
 *    LoRa MOSI -> GPIO 23
 *    LoRa NSS  -> GPIO 5
 *    LoRa RST  -> GPIO 14
 *    LoRa DIO0 -> GPIO 26
 *    LoRa VCC  -> 3.3V  (DO NOT use 5V)
 *    LoRa GND  -> GND
 * ==========================================================================
 */

#include <LoRa.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiUdp.h>

// ==========================================
// WIFI CONFIGURATION
// Change to your WiFi credentials, or leave as default.
// If it cannot connect to your router, it automatically creates
// its own Hotspot: "CubeSat-GS-WiFi" (Password: "cubesat1234")
// ==========================================
const char *WIFI_SSID = "Nakul";      // <-- Put your WiFi Name here
const char *WIFI_PASS = "1234567890"; // <-- Put your WiFi Password here

const char *AP_SSID = "CubeSat-GS-WiFi";
const char *AP_PASS = "cubesat1234";
const unsigned int UDP_PORT = 8888;

WiFiUDP udp;
bool wifi_connected = false;

// ==========================================
// LORA PIN CONFIGURATION
// Must match CubeSat transmitter exactly
// ==========================================
#define LORA_SCK 18
#define LORA_MISO 19
#define LORA_MOSI 23
#define LORA_SS 5
#define LORA_RST 14
#define LORA_DIO0 26
#define LORA_BAND 433E6 // Must match cubesat.ino: 433E6 / 868E6 / 915E6

// ==========================================
// LORA RF SETTINGS
// Must exactly match CubeSat transmitter
// ==========================================
#define LORA_SF 7      // Spreading Factor (7-12)
#define LORA_BW 125E3  // Signal Bandwidth Hz
#define LORA_CR 5      // Coding Rate 4/5
#define LORA_TX_DBM 17 // TX power

// ==========================================
// SERIAL BAUD RATE (must match server.py)
// ==========================================
#define SERIAL_BAUD 115200

unsigned long packetsReceived = 0;

void initWiFi() {
  Serial.println("\n[WiFi] Initializing WiFi Dual-Link...");
  WiFi.mode(WIFI_AP_STA);

  if (String(WIFI_SSID) != "YOUR_WIFI_SSID" && String(WIFI_SSID).length() > 0) {
    Serial.printf("[WiFi] Connecting to %s ...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 7000) {
      delay(300);
      Serial.print(".");
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.println("\n[WiFi] CONNECTED to Station network!");
    Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Starting standalone Access Point fallback...");
    WiFi.softAP(AP_SSID, AP_PASS);
    wifi_connected = true;
    Serial.printf("[WiFi] AP Started: SSID: %s | Pass: %s\n", AP_SSID, AP_PASS);
    Serial.printf("[WiFi] AP IP Address: %s\n",
                  WiFi.softAPIP().toString().c_str());
  }

  udp.begin(UDP_PORT);
  Serial.printf("[WiFi] UDP Broadcast transmitter armed on port %u\n\n",
                UDP_PORT);
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(500);

  Serial.println("\n==========================================");
  Serial.println(" CubeSat-1 LoRa Ground Station (WiFi+USB) ");
  Serial.println("==========================================");

  // 1. Initialize SPI & LoRa FIRST (ensures immediate RF reception)
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  Serial.print("[LoRa] Initializing SX1278 at ");
  Serial.print(LORA_BAND / 1E6);
  Serial.println(" MHz...");

  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[LoRa Error]: LoRa.begin() FAILED! Check SPI wiring: SCK(18), MISO(19), MOSI(23), NSS(5), RST(14), DIO0(26), 3.3V, GND.");
    int retries = 0;
    while (retries < 10) {
      delay(1000);
      Serial.printf("[LoRa] Retrying initialization (%d/10)...\n", ++retries);
      if (LoRa.begin(LORA_BAND)) break;
    }
  }

  // Apply matching RF settings
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BW);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setSyncWord(0x12); // Standard matching LoRa sync word
  LoRa.enableCrc();       // CRC integrity check

  Serial.println("[LoRa] SUCCESS - SX1278 Receiver Armed & Listening!");

  // 2. Initialize WiFi Dual-Link (in background)
  initWiFi();

  Serial.println("\n[LoRa] Waiting for CubeSat-1 telemetry packets...\n");
}

void loop() {
  // Non-blocking packet parse
  int packetSize = LoRa.parsePacket();

  if (packetSize > 0) {
    // Read incoming bytes
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }

    incoming.trim();
    if (incoming.length() == 0)
      return;

    // Get RSSI and SNR link quality metrics
    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();
    packetsReceived++;

    // Format: <original_packet>,RSSI:<rssi>,SNR:<snr>,GS_PKT:<count>
    String fullPacket = incoming + ",RSSI:" + String(rssi) +
                        ",SNR:" + String(snr, 1) +
                        ",GS_PKT:" + String(packetsReceived);

    // 1. Forward over USB Serial
    if (incoming.indexOf("HELLO") >= 0) {
      Serial.printf("[LINK_ESTABLISHED] 🚀 HELLO handshake received from "
                    "CubeSat-1! (RSSI: %d dBm, SNR: %.1f dB)\n",
                    rssi, snr);
    } else if (packetsReceived == 1) {
      Serial.printf("[LINK_ESTABLISHED] 🚀 LoRa Link Active! CubeSat-1 "
                    "connected. (RSSI: %d dBm, SNR: %.1f dB)\n",
                    rssi, snr);
    }
    Serial.println(fullPacket);

    // 2. Broadcast over WiFi UDP to Computer / Mission Control Dashboard
    if (wifi_connected) {
      udp.beginPacket(IPAddress(255, 255, 255, 255), UDP_PORT);
      udp.write((const uint8_t *)fullPacket.c_str(), fullPacket.length());
      udp.endPacket();
    }
  }
}
