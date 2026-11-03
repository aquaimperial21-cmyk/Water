// What the purifier knows: who it is, what the server last said about the
// plan, the time, and the valve.
//
// The one rule: water flows only when the customer's switch is ON and the
// plan allows it. The plan allows it while the server's last answer was
// allowFlow=true and the clock is before expiresAt + graceDays. With no
// internet the saved answer keeps working until then. If the time is unknown
// (power cut and no internet since), the valve stays closed.

#pragma once

#include <Arduino.h>

namespace purifier {

struct Plan {
  bool known;          // false until the server has answered once (ever)
  bool allowFlow;      // the server's allowFlow
  uint32_t until;      // expiresAt + graceDays, UTC seconds; 0 = none
  char status[24];     // ACTIVE, GRACE, SUSPENDED, ..., PAIRING_REQUIRED, UNKNOWN
  char message[96];    // the server's message, "" when none
};

// Loads saved settings. The valve starts closed.
void begin();

// ── Identity: set over USB, takes effect after a reboot ─────────────────────
bool provisioned();
const String &serial();
const String &token();
const String &localKey();  // HMAC-SHA256(token, "smartro-local-v1"), hex
bool saveSerial(const String &s);
bool saveToken(const String &t);
String maskedToken();

// ── Plan: written by the cloud task ──────────────────────────────────────────
void setPlanFromServer(bool allowFlow, const char *status, uint32_t until, const char *message);
void setPairingRequired();
Plan plan();
bool planAllows();

// ── Clock ────────────────────────────────────────────────────────────────────
uint32_t now();                  // UTC seconds, 0 when unknown
void setServerTime(uint32_t epoch);
void saveClockFloorIfDue();      // call from loop

// ── Customer switch (saved across reboots, starts ON) ───────────────────────
bool wantOn();
void setWantOn(bool on);

// ── Valve ────────────────────────────────────────────────────────────────────
void updateValve();              // call from loop
bool valveOpen();

// ── Server reachability ─────────────────────────────────────────────────────
void noteCloud(bool ok);
bool cloudOk();
int32_t lastCloudSecAgo();       // -1 when the server never answered since boot

// Short text for the app, "" when there's nothing to say.
String customerMessage();

// ── Saved Wi-Fi ──────────────────────────────────────────────────────────────
struct WifiSettings {
  String ssid;
  String pass;
  bool verified;  // joined successfully at least once
};
WifiSettings loadWifi();
void saveWifi(const String &ssid, const String &pass);
void markWifiVerified();
void forgetWifi();
void setWifiError(const String &msg);   // shown on the setup page after a failed join
String takeWifiError();
void requestSetupOnBoot();
bool takeSetupRequest();

// Wipes serial, token, Wi-Fi, saved plan and clock.
void factoryReset();

}  // namespace purifier
