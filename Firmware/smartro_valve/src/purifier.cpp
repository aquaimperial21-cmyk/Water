#include "purifier.h"

#include <Preferences.h>
#include <driver/gpio.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <sys/time.h>
#include <time.h>

#include "config.h"
#include "util.h"

namespace purifier {
namespace {

constexpr uint32_t MIN_VALID_EPOCH = 1735689600;  // 2025-01-01; anything earlier = clock not set
constexpr uint32_t FLOOR_SAVE_STEP = 15UL * 60UL;  // write the clock floor to flash at most every 15 min

// Set once in begin(), read-only afterwards, so both tasks can read them freely.
String serial_;
String token_;
String localKey_;

// Loop task only.
bool wantOn_ = true;
bool valveOpen_ = false;

// Shared with the cloud task: guarded by lock_.
SemaphoreHandle_t lock_ = nullptr;
Plan plan_ = {};
uint32_t floor_ = 0;       // the clock never reads earlier than this...
uint32_t floorMs_ = 0;     // ...plus the seconds since millis() was floorMs_
uint32_t savedFloor_ = 0;  // the floor value in flash
bool cloudOk_ = false;
bool cloudEverOk_ = false;
uint32_t lastCloudOkMs_ = 0;

struct Guard {
  Guard() { xSemaphoreTake(lock_, portMAX_DELAY); }
  ~Guard() { xSemaphoreGive(lock_); }
};

int relayLevel(bool open) {
  const int onLevel = RELAY_ACTIVE_LOW ? LOW : HIGH;
  return open ? onLevel : !onLevel;
}

bool validSerial(const String &s) {
  if (s.length() < 1 || s.length() > 40) return false;
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (!isalnum(static_cast<unsigned char>(c)) && c != '-' && c != '_') return false;
  }
  return true;
}

bool validToken(const String &t) {
  if (t.length() < 8 || t.length() > 128) return false;
  for (size_t i = 0; i < t.length(); i++) {
    if (t[i] < 0x21 || t[i] > 0x7e) return false;  // printable, no spaces
  }
  return true;
}

uint32_t floorNowLocked() {
  if (floor_ == 0) return 0;
  return floor_ + (millis() - floorMs_) / 1000;
}

void writeFloor(uint32_t value) {
  Preferences p;
  p.begin("clock", false);
  p.putUInt("floor", value);
  p.end();
}

void writePlan(const Plan &p) {
  Preferences prefs;
  prefs.begin("plan", false);
  prefs.putBool("known", p.known);
  prefs.putBool("allow", p.allowFlow);
  prefs.putUInt("until", p.until);
  prefs.putString("status", p.status);
  prefs.putString("msg", p.message);
  prefs.end();
}

bool samePlan(const Plan &a, const Plan &b) {
  return a.known == b.known && a.allowFlow == b.allowFlow && a.until == b.until &&
         strcmp(a.status, b.status) == 0 && strcmp(a.message, b.message) == 0;
}

void storePlan(const Plan &next) {
  bool changed;
  {
    Guard g;
    changed = !samePlan(plan_, next);
    if (changed) plan_ = next;
  }
  if (changed) writePlan(next);  // only on change: polls every minute would wear the flash
}

}  // namespace

void begin() {
  // Closed before anything else. Set the level first so an active-low relay doesn't click on.
  gpio_set_level(static_cast<gpio_num_t>(pins::RELAY), relayLevel(false));
  pinMode(pins::RELAY, OUTPUT);
  digitalWrite(pins::RELAY, relayLevel(false));
  valveOpen_ = false;

  lock_ = xSemaphoreCreateMutex();

  Preferences p;
  p.begin("dev", false);
  serial_ = p.getString("serial", "");
  token_ = p.getString("token", "");
  wantOn_ = p.getBool("want", true);
  p.end();
  localKey_ = token_.length() ? hmacSha256Hex(token_, "smartro-local-v1") : String();

  p.begin("plan", false);
  plan_.known = p.getBool("known", false);
  plan_.allowFlow = p.getBool("allow", false);
  plan_.until = p.getUInt("until", 0);
  strlcpy(plan_.status, p.getString("status", "UNKNOWN").c_str(), sizeof(plan_.status));
  strlcpy(plan_.message, p.getString("msg", "").c_str(), sizeof(plan_.message));
  p.end();

  p.begin("clock", false);
  savedFloor_ = p.getUInt("floor", 0);
  p.end();
  floor_ = savedFloor_;
  floorMs_ = millis();
}

// ── Identity ────────────────────────────────────────────────────────────────

bool provisioned() { return serial_.length() > 0 && token_.length() > 0; }
const String &serial() { return serial_; }
const String &token() { return token_; }
const String &localKey() { return localKey_; }

bool saveSerial(const String &s) {
  if (!validSerial(s)) return false;
  Preferences p;
  p.begin("dev", false);
  p.putString("serial", s);
  p.end();
  return true;
}

bool saveToken(const String &t) {
  if (!validToken(t)) return false;
  Preferences p;
  p.begin("dev", false);
  p.putString("token", t);
  p.end();
  return true;
}

String maskedToken() {
  if (token_.length() == 0) return "(none)";
  return token_.substring(0, 4) + "... (" + String(token_.length()) + " chars)";
}

// ── Plan ────────────────────────────────────────────────────────────────────

void setPlanFromServer(bool allowFlow, const char *status, uint32_t until, const char *message) {
  Plan next = {};
  next.known = true;
  next.allowFlow = allowFlow;
  next.until = until;
  strlcpy(next.status, status ? status : "UNKNOWN", sizeof(next.status));
  strlcpy(next.message, message ? message : "", sizeof(next.message));
  storePlan(next);
}

void setPairingRequired() {
  Plan next = {};
  next.known = true;
  next.allowFlow = false;
  next.until = 0;
  strlcpy(next.status, "PAIRING_REQUIRED", sizeof(next.status));
  strlcpy(next.message, "Pairing required", sizeof(next.message));
  storePlan(next);
}

Plan plan() {
  Guard g;
  return plan_;
}

bool planAllows() {
  if (!provisioned()) return false;
  Plan p = plan();
  if (!p.known || !p.allowFlow || p.until == 0) return false;
  uint32_t n = now();
  return n != 0 && n <= p.until;
}

// ── Clock ───────────────────────────────────────────────────────────────────
//
// Time comes from the server's serverTime (trusted) or NTP. The floor stops a
// faked NTP answer from winding the clock back to stretch a plan: the clock
// never reads earlier than the last time it knew, plus the time it has been
// running since.

uint32_t now() {
  time_t t = time(nullptr);
  if (t < static_cast<time_t>(MIN_VALID_EPOCH)) return 0;
  uint32_t f;
  {
    Guard g;
    f = floorNowLocked();
  }
  uint32_t n = static_cast<uint32_t>(t);
  return n < f ? f : n;
}

void setServerTime(uint32_t epoch) {
  if (epoch < MIN_VALID_EPOCH) return;
  time_t t = time(nullptr);
  int64_t drift = static_cast<int64_t>(t) - static_cast<int64_t>(epoch);
  if (t < static_cast<time_t>(MIN_VALID_EPOCH) || drift > 30 || drift < -30) {
    struct timeval tv = {static_cast<time_t>(epoch), 0};
    settimeofday(&tv, nullptr);
  }
  bool save = false;
  {
    Guard g;
    floor_ = epoch;  // the server is the reference: this also undoes a floor that ran ahead
    floorMs_ = millis();
    int64_t diff = static_cast<int64_t>(epoch) - static_cast<int64_t>(savedFloor_);
    if (diff > FLOOR_SAVE_STEP || diff < -static_cast<int64_t>(FLOOR_SAVE_STEP)) {
      savedFloor_ = epoch;
      save = true;
    }
  }
  if (save) writeFloor(epoch);
}

void saveClockFloorIfDue() {
  uint32_t n = now();
  if (n == 0) return;
  bool save = false;
  {
    Guard g;
    if (n > savedFloor_ + FLOOR_SAVE_STEP) {
      floor_ = n;
      floorMs_ = millis();
      savedFloor_ = n;
      save = true;
    }
  }
  if (save) writeFloor(n);
}

// ── Switch and valve ────────────────────────────────────────────────────────

bool wantOn() { return wantOn_; }

void setWantOn(bool on) {
  if (on == wantOn_) return;
  wantOn_ = on;
  Preferences p;
  p.begin("dev", false);
  p.putBool("want", on);
  p.end();
}

void updateValve() {
  bool open = wantOn_ && planAllows();
  if (open == valveOpen_) return;
  digitalWrite(pins::RELAY, relayLevel(open));
  valveOpen_ = open;
  Serial.printf("[valve] %s\n", open ? "OPEN  -> water flows" : "CLOSED -> water stopped");
}

bool valveOpen() { return valveOpen_; }

// ── Server reachability ─────────────────────────────────────────────────────

void noteCloud(bool ok) {
  Guard g;
  cloudOk_ = ok;
  if (ok) {
    cloudEverOk_ = true;
    lastCloudOkMs_ = millis();
  }
}

bool cloudOk() {
  Guard g;
  return cloudOk_;
}

int32_t lastCloudSecAgo() {
  Guard g;
  if (!cloudEverOk_) return -1;
  return static_cast<int32_t>((millis() - lastCloudOkMs_) / 1000);
}

String customerMessage() {
  if (!provisioned()) return "This purifier is not set up yet.";
  Plan p = plan();
  if (strcmp(p.status, "PAIRING_REQUIRED") == 0) return "Pairing required. Please contact SmartRO support.";
  if (!p.known) return "Checking your plan. The purifier needs internet once.";
  if (now() == 0) return "Waiting for internet to check your plan.";
  if (!planAllows()) {
    if (p.message[0] && p.allowFlow == false) return String(p.message);
    return "Your plan is not active. Recharge to turn the water on.";
  }
  return "";
}

// ── Saved Wi-Fi ─────────────────────────────────────────────────────────────

WifiSettings loadWifi() {
  WifiSettings w;
  Preferences p;
  p.begin("wifi", false);
  w.ssid = p.getString("ssid", "");
  w.pass = p.getString("pass", "");
  w.verified = p.getBool("ok", false);
  p.end();
  return w;
}

void saveWifi(const String &ssid, const String &pass) {
  Preferences p;
  p.begin("wifi", false);
  p.putString("ssid", ssid);
  p.putString("pass", pass);
  p.putBool("ok", false);
  p.end();
}

void markWifiVerified() {
  Preferences p;
  p.begin("wifi", false);
  if (!p.getBool("ok", false)) p.putBool("ok", true);
  p.end();
}

void forgetWifi() {
  Preferences p;
  p.begin("wifi", false);
  p.remove("ssid");
  p.remove("pass");
  p.remove("ok");
  p.end();
}

void setWifiError(const String &msg) {
  Preferences p;
  p.begin("wifi", false);
  p.putString("err", msg);
  p.end();
}

String takeWifiError() {
  Preferences p;
  p.begin("wifi", false);
  String e = p.getString("err", "");
  if (e.length()) p.remove("err");
  p.end();
  return e;
}

void requestSetupOnBoot() {
  Preferences p;
  p.begin("wifi", false);
  p.putBool("setup", true);
  p.end();
}

bool takeSetupRequest() {
  Preferences p;
  p.begin("wifi", false);
  bool v = p.getBool("setup", false);
  if (v) p.remove("setup");
  p.end();
  return v;
}

void factoryReset() {
  const char *spaces[] = {"dev", "wifi", "plan", "clock"};
  for (const char *ns : spaces) {
    Preferences p;
    p.begin(ns, false);
    p.clear();
    p.end();
  }
}

}  // namespace purifier
