#include "cloud.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <WiFi.h>

#include "certs.h"
#include "config.h"
#include "purifier.h"
#include "util.h"

namespace cloud {
namespace {

volatile bool pollSoon_ = false;

struct Reply {
  int code;     // HTTP status, or < 0 when the request never got an answer
  String body;
};

Reply request(bool post, const String &path, const String &body) {
  Reply r{-1, String()};
  const String url = String(API_BASE) + path;

  NetworkClientSecure secure;
  NetworkClient plain;
  NetworkClient *client = &plain;
  if (url.startsWith("https://")) {
    secure.setCACert(ROOT_CAS);  // only Let's Encrypt roots: a fake server can't answer
    client = &secure;
  }

  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(10000);
  http.setReuse(false);
  http.setUserAgent("SmartRO-Valve/" FW_VERSION);
  if (!http.begin(*client, url)) return r;
  http.addHeader("X-Device-Token", purifier::token());
  http.addHeader("Accept", "application/json");
  if (post) {
    http.addHeader("Content-Type", "application/json");
    r.code = http.POST(body);
  } else {
    r.code = http.GET();
  }
  if (r.code > 0) r.body = http.getString();
  http.end();
  return r;
}

// True only when our own server says the token or serial is wrong. A hosting
// error page must not count: while the API is down, the proxy in front of it
// answers with its own error page, and treating a 404 there as "device not
// found" would cut the water in every home at once.
bool isPairingError(const Reply &r) {
  if (r.code != 401 && r.code != 404) return false;
  JsonDocument doc;
  if (deserializeJson(doc, r.body)) return false;
  const char *code = doc["error"]["code"] | "";
  const char *message = doc["error"]["message"] | "";
  if (r.code == 401) return strcmp(code, "UNAUTHORIZED") == 0 && strstr(message, "device token") != nullptr;
  return strcmp(code, "NOT_FOUND") == 0 && strcmp(message, "Device not found") == 0;
}

enum class Outcome { Ok, Pairing, Failed };

Outcome pollState(uint32_t &nextSec) {
  Reply r = request(false, "/devices/" + purifier::serial() + "/state", "");

  if (r.code == 200) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, r.body);
    JsonObject d = doc["data"];
    if (err || d.isNull() || !d["allowFlow"].is<bool>()) {
      Serial.println("[cloud] state: unreadable answer, keeping the saved plan");
      return Outcome::Failed;
    }

    uint32_t serverNow = 0;
    if (parseIsoUtc(d["serverTime"].as<const char *>(), serverNow)) purifier::setServerTime(serverNow);

    const bool allow = d["allowFlow"].as<bool>();
    int graceDays = d["graceDays"] | 0;
    if (graceDays < 0) graceDays = 0;
    if (graceDays > 365) graceDays = 365;
    uint32_t until = 0;
    uint32_t expires = 0;
    if (parseIsoUtc(d["expiresAt"].as<const char *>(), expires)) {
      until = expires + static_cast<uint32_t>(graceDays) * 86400UL;
    } else if (allow) {
      Serial.println("[cloud] state: allowFlow without a readable expiresAt, keeping water off");
    }
    purifier::setPlanFromServer(allow, d["status"].as<const char *>(), until, d["message"].as<const char *>());

    int poll = d["pollIntervalSec"] | static_cast<int>(timing::DEFAULT_POLL_SEC);
    if (poll < 30) poll = 30;
    if (poll > 3600) poll = 3600;
    nextSec = static_cast<uint32_t>(poll);

    Serial.printf("[cloud] plan %s, allowFlow=%s, until %s, next check in %d s\n",
                  d["status"] | "?", allow ? "true" : "false",
                  until ? formatIsoUtc(until).c_str() : "-", poll);
    return Outcome::Ok;
  }

  if (isPairingError(r)) {
    Serial.printf("[cloud] state: HTTP %d, the server doesn't accept this serial/token. Water off.\n", r.code);
    purifier::setPairingRequired();
    nextSec = timing::PAIRING_RETRY_SEC;
    return Outcome::Pairing;
  }

  if (r.code < 0) {
    Serial.printf("[cloud] state: no answer (%s), keeping the saved plan\n", HTTPClient::errorToString(r.code).c_str());
  } else {
    Serial.printf("[cloud] state: HTTP %d, keeping the saved plan\n", r.code);
  }
  return Outcome::Failed;
}

bool sendHeartbeat() {
  JsonDocument doc;
  doc["firmwareVersion"] = FW_VERSION;
  doc["wifiSsid"] = WiFi.SSID();
  doc["localIp"] = WiFi.localIP().toString();  // lets the app find this purifier on the home Wi-Fi
  String body;
  serializeJson(doc, body);

  Reply r = request(true, "/devices/" + purifier::serial() + "/heartbeat", body);
  if (r.code == 200) {
    Serial.printf("[cloud] heartbeat sent (IP %s)\n", WiFi.localIP().toString().c_str());
    return true;
  }
  if (isPairingError(r)) purifier::setPairingRequired();
  Serial.printf("[cloud] heartbeat failed: %d\n", r.code);
  return false;
}

void task(void *) {
  bool polledOnce = false;
  uint32_t lastPollMs = 0;
  uint32_t pollEveryMs = 0;
  uint32_t retrySec = timing::RETRY_MIN_SEC;

  bool beatOnce = false;
  uint32_t lastBeatMs = 0;
  uint32_t beatEveryMs = timing::HEARTBEAT_MS;
  String lastBeatIp;

  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(250));
    if (WiFi.status() != WL_CONNECTED) continue;

    const bool soon = pollSoon_;
    if (soon) pollSoon_ = false;

    if (soon || !polledOnce || millis() - lastPollMs >= pollEveryMs) {
      uint32_t nextSec = timing::DEFAULT_POLL_SEC;
      const Outcome o = pollState(nextSec);
      purifier::noteCloud(o == Outcome::Ok);
      if (o == Outcome::Failed) {
        nextSec = retrySec;
        retrySec = retrySec * 2 > timing::RETRY_MAX_SEC ? timing::RETRY_MAX_SEC : retrySec * 2;
      } else {
        retrySec = timing::RETRY_MIN_SEC;
      }
      polledOnce = true;
      lastPollMs = millis();
      pollEveryMs = nextSec * 1000UL;
    }

    const String ip = WiFi.localIP().toString();
    if (soon || !beatOnce || ip != lastBeatIp || millis() - lastBeatMs >= beatEveryMs) {
      const bool ok = sendHeartbeat();
      beatOnce = true;
      lastBeatMs = millis();
      lastBeatIp = ip;
      beatEveryMs = ok ? timing::HEARTBEAT_MS : 10UL * 60UL * 1000UL;
    }
  }
}

}  // namespace

void begin() {
  const bool https = String(API_BASE).startsWith("https://");
#if REQUIRE_HTTPS
  if (!https) {
    Serial.println("[cloud] this build needs an https:// server address. Server checks are OFF.");
    return;
  }
#endif
  if (!https) {
    Serial.println("[cloud] TEST BUILD: plain http to " API_BASE " (the token travels unencrypted)");
  }
  if (!purifier::provisioned()) {
    Serial.println("[cloud] no serial/token yet, so no server checks. Type: help");
    return;
  }
  xTaskCreatePinnedToCore(task, "cloud", 16384, nullptr, 1, nullptr, 0);
}

void pollSoon() { pollSoon_ = true; }

}  // namespace cloud
