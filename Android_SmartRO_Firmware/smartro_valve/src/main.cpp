// SmartRO purifier valve firmware.
//
// - Joins the home Wi-Fi (set up from a phone through the setup hotspot).
// - Asks the SmartRO server whether the plan is paid; keeps the answer in
//   flash so water keeps flowing offline until the plan's end date.
// - Lets the SmartRO app on the same Wi-Fi turn the water on and off.
//   OFF always works; ON only while the plan allows it.
//
// Blue LED:  steady on = water on · off = water off ·
//            short flash every second = looking for Wi-Fi · slow blink = setup hotspot open.
// BOOT button held 5 s: open the Wi-Fi setup hotspot.

#include <Arduino.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WiFi.h>

#include "cloud.h"
#include "config.h"
#include "console.h"
#include "local_api.h"
#include "ota.h"
#include "portal.h"
#include "purifier.h"
#include "util.h"

namespace {

WebServer server(80);
DNSServer dns;

bool setupMode = false;
String hostName;  // smartro-a1b2c3
String wifiSsid;

volatile bool gotIp = false;
bool wifiVerified = false;
bool everConnected = false;
bool servicesStarted = false;
uint32_t joinStartMs = 0;
uint32_t lastFloorCheckMs = 0;

void onGotIp(arduino_event_id_t, arduino_event_info_t) { gotIp = true; }

void startSetup(bool canTimeOut) {
  setupMode = true;
  portal::begin(server, dns, "SmartRO-Setup-" + macSuffix(), canTimeOut);
}

void startNormal(const purifier::WifiSettings &w) {
  setupMode = false;
  wifiSsid = w.ssid;
  wifiVerified = w.verified;

  WiFi.persistent(false);  // our own copy of the Wi-Fi settings lives in "wifi"
  WiFi.setHostname(hostName.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // answer the app quickly; the purifier runs on mains power
  WiFi.setAutoReconnect(true);
  WiFi.onEvent(onGotIp, ARDUINO_EVENT_WIFI_STA_GOT_IP);
  WiFi.begin(w.ssid.c_str(), w.pass.c_str());
  joinStartMs = millis();
  Serial.printf("[wifi] joining \"%s\"...\n", w.ssid.c_str());

  local_api::begin(server);
  cloud::begin();
}

void onConnected() {
  everConnected = true;
  Serial.printf("[wifi] connected to \"%s\", IP %s\n", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
  if (!wifiVerified) {
    purifier::markWifiVerified();
    wifiVerified = true;
  }
  if (!servicesStarted) {
    servicesStarted = true;
    configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
    if (MDNS.begin(hostName.c_str())) {
      MDNS.addService("http", "tcp", 80);
      MDNS.addService("smartro", "tcp", 80);
    }
  }
  Serial.printf("[wifi] the app reaches this purifier at http://%s/ (or http://%s.local/)\n",
                WiFi.localIP().toString().c_str(), hostName.c_str());
  cloud::pollSoon();
}

void normalLoop() {
  if (gotIp) {
    gotIp = false;
    onConnected();
  }
  // A Wi-Fi that has never worked (wrong password?) gets 45 s, then setup opens again.
  if (!wifiVerified && !everConnected && WiFi.status() != WL_CONNECTED &&
      millis() - joinStartMs > timing::FIRST_JOIN_TIMEOUT_MS) {
    Serial.println("[wifi] couldn't join, opening the setup hotspot again");
    purifier::setWifiError("Couldn't join \"" + wifiSsid + "\". Check the Wi-Fi name and password.");
    purifier::requestSetupOnBoot();
    delay(200);
    ESP.restart();
  }
  if (millis() - lastFloorCheckMs > 10000) {
    lastFloorCheckMs = millis();
    purifier::saveClockFloorIfDue();
  }
}

void checkButton() {
  static uint32_t downSinceMs = 0;
  static bool down = false;
  const bool pressed = digitalRead(pins::BUTTON) == LOW;
  if (!pressed) {
    down = false;
    return;
  }
  if (!down) {
    down = true;
    downSinceMs = millis();
    return;
  }
  if (millis() - downSinceMs >= timing::SETUP_HOLD_MS) {
    Serial.println("[button] BOOT held 5 s: opening the Wi-Fi setup hotspot");
    purifier::requestSetupOnBoot();
    delay(200);
    ESP.restart();
  }
}

void updateLed() {
  const uint32_t ms = millis();
  bool on;
  if (setupMode) {
    on = (ms / 500) % 2;  // slow blink
  } else if (WiFi.status() != WL_CONNECTED) {
    on = (ms % 1000) < 100;  // short flash
  } else {
    on = purifier::valveOpen();
  }
  digitalWrite(pins::LED, on ? HIGH : LOW);
}

}  // namespace

void setup() {
  purifier::begin();  // valve closed before anything else
  pinMode(pins::LED, OUTPUT);
  digitalWrite(pins::LED, LOW);
  pinMode(pins::BUTTON, INPUT_PULLUP);

  Serial.begin(115200);
  delay(300);
  hostName = "smartro-" + macSuffix();
  console::begin(hostName);

  Serial.printf("\n\nSmartRO valve firmware %s (%s)\n", FW_VERSION, hostName.c_str());
  ota::begin();  // a new update on trial, or the result of the last one
  if (!purifier::provisioned()) {
    Serial.println("Not set up yet. Type:  serial <SERIAL>  then  token <TOKEN>  then  reboot");
  }

  const purifier::WifiSettings w = purifier::loadWifi();
  const bool setupRequested = purifier::takeSetupRequest();
  if (w.ssid.isEmpty() || setupRequested) {
    startSetup(setupRequested && w.ssid.length() > 0 && w.verified);
  } else {
    startNormal(w);
  }
  Serial.println("Type help for commands.");
}

void loop() {
  console::loop();
  checkButton();
  if (setupMode) {
    portal::loop();
  } else {
    normalLoop();
  }
  server.handleClient();
  purifier::updateValve();
  ota::loop();
  updateLed();
  delay(2);
}
