#include "cloud.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <WiFi.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

#include <atomic>

#include "certs.h"
#include "config.h"
#include "ota.h"
#include "purifier.h"
#include "util.h"

namespace cloud {

bool beginRequest(HTTPClient &http, NetworkClientSecure &secure, NetworkClient &plain, const String &path,
                  uint16_t readTimeoutMs) {
  const String url = String(API_BASE) + path;
  NetworkClient *client = &plain;
  if (url.startsWith("https://")) {
    secure.setCACert(ROOT_CAS);  // only Let's Encrypt roots: a fake server can't answer
    secure.setHandshakeTimeout(30);  // seconds; the library default is 120
    client = &secure;
  } else if (REQUIRE_HTTPS) {
    return false;
  }

  http.setConnectTimeout(8000);
  http.setTimeout(readTimeoutMs);
  http.setReuse(false);
  http.setUserAgent("SmartRO-Valve/" FW_VERSION);
  if (!http.begin(*client, url)) return false;
  http.addHeader("X-Device-Token", purifier::token());
  http.addHeader("X-Firmware-Version", FW_VERSION);  // the server compares it with its releases
  return true;
}

namespace {

// Written once in begin(); other tasks only read it.
TaskHandle_t volatile task_ = nullptr;
// Set by any task, taken (exchange) by the cloud task.
std::atomic<bool> pollSoon_{false};
std::atomic<bool> beatSoon_{false};

// The next check as the console sees it, written by the cloud task each pass.
portMUX_TYPE mux_ = portMUX_INITIALIZER_UNLOCKED;
int64_t shownAtMs_ = 0;  // uptimeMs() of the next GET /state
const char *shownWhy_ = "first check after Wi-Fi joins";

void wake() {
  TaskHandle_t t = task_;
  if (t) xTaskNotifyGive(t);  // never blocks; a pending notification stays pending
}

struct Reply {
  int code;     // HTTP status, or < 0 when the request never got an answer
  String body;
};

Reply request(bool post, const String &path, const String &body, bool sendLocalIp) {
  Reply r{-1, String()};
  NetworkClientSecure secure;
  NetworkClient plain;
  HTTPClient http;
  if (!beginRequest(http, secure, plain, path, 10000)) return r;
  http.addHeader("Accept", "application/json");
  // The server stores it: the app finds this purifier on the home Wi-Fi by it.
  if (sendLocalIp && WiFi.status() == WL_CONNECTED) http.addHeader("X-Local-Ip", WiFi.localIP().toString());
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
  Reply r = request(false, "/devices/" + purifier::serial() + "/state", "", true);

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

    int32_t poll = d["pollIntervalSec"] | static_cast<int32_t>(timing::DEFAULT_POLL_SEC);
    if (poll < static_cast<int32_t>(timing::POLL_MIN_SEC)) poll = timing::POLL_MIN_SEC;
    if (poll > static_cast<int32_t>(timing::POLL_MAX_SEC)) poll = timing::POLL_MAX_SEC;
    nextSec = static_cast<uint32_t>(poll);

    Serial.printf("[cloud] plan %s, allowFlow=%s, until %s, next check in %ld s\n",
                  d["status"] | "?", allow ? "true" : "false",
                  until ? formatIsoUtc(until).c_str() : "-", static_cast<long>(poll));

    ota::handleOffer(d["firmware"].as<JsonObjectConst>());
    ota::onStateOk();
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

  Reply r = request(true, "/devices/" + purifier::serial() + "/heartbeat", body, false);
  if (r.code == 200) {
    Serial.printf("[cloud] heartbeat sent (IP %s)\n", WiFi.localIP().toString().c_str());
    return true;
  }
  if (isPairingError(r)) purifier::setPairingRequired();
  Serial.printf("[cloud] heartbeat failed: %d\n", r.code);
  return false;
}

// When the next GET /state is due. Waits are kept on the 64-bit uptime clock
// and in UTC seconds, so a 24 h wait is plain arithmetic (no millis() wrap).
struct Schedule {
  bool polledOnce = false;
  int64_t dueMs = 0;         // the server's pollIntervalSec, or a retry (uptimeMs)
  const char *dueWhy = "";
  uint32_t planEndUtc = 0;   // just after the saved plan ends; 0 = none
  uint32_t nightUtc = 0;     // this purifier's next night-window start; 0 = clock unknown
};

void reschedule(Schedule &s, uint32_t nextSec, Outcome o) {
  s.polledOnce = true;
  s.dueMs = uptimeMs() + static_cast<int64_t>(nextSec) * 1000;
  s.dueWhy = o == Outcome::Ok        ? "server schedule"
             : o == Outcome::Pairing ? "pairing retry"
                                     : "retry after a failed check";
  s.planEndUtc = 0;
  s.nightUtc = 0;
  const uint32_t t = purifier::now();
  if (!t) return;
  // The valve closes by itself at the end; this check sees a recharge made just before it.
  const purifier::Plan p = purifier::plan();
  if (purifier::planAllows() && p.until >= t) s.planEndUtc = p.until + timing::PLAN_END_MARGIN_SEC;
  // A paid purifier checks about once a day: without this, an update released
  // during the day would wait for a check that falls inside the night window.
  s.nightUtc = ota::nextWindowStart(t);
}

// Milliseconds until the next GET /state (0 = due now), and why.
int64_t msUntilCheck(const Schedule &s, const char *&why) {
  if (!s.polledOnce) {
    why = "first check after Wi-Fi joins";
    return 0;
  }
  int64_t wait = s.dueMs - uptimeMs();
  why = s.dueWhy;
  const uint32_t t = purifier::now();
  if (t) {
    const auto earlier = [&](uint32_t atUtc, const char *w) {
      if (!atUtc) return;
      const int64_t ms = (static_cast<int64_t>(atUtc) - static_cast<int64_t>(t)) * 1000;
      if (ms < wait) {
        wait = ms;
        why = w;
      }
    };
    earlier(s.planEndUtc, "just after the plan ends");
    earlier(s.nightUtc, "night update window");
  }
  return wait < 0 ? 0 : wait;
}

struct Beat {
  bool tried = false;  // since boot
  int64_t dueMs = 0;   // uptimeMs
  String ip;           // the IP the last heartbeat reported
};

void task(void *) {
  Schedule s;
  Beat b;
  uint32_t retrySec = timing::RETRY_MIN_SEC;

  for (;;) {
    const bool online = WiFi.status() == WL_CONNECTED;
    if (online) {
      const bool soon = pollSoon_.exchange(false);
      const char *why = "";
      if (soon || msUntilCheck(s, why) == 0) {
        uint32_t nextSec = timing::DEFAULT_POLL_SEC;
        const Outcome o = pollState(nextSec);
        purifier::noteCloud(o == Outcome::Ok);
        if (o == Outcome::Failed) {
          nextSec = retrySec;
          retrySec = retrySec * 2 > timing::RETRY_MAX_SEC ? timing::RETRY_MAX_SEC : retrySec * 2;
        } else {
          retrySec = timing::RETRY_MIN_SEC;
        }
        reschedule(s, nextSec, o);
        const int64_t in = msUntilCheck(s, why);
        if (in < static_cast<int64_t>(nextSec) * 1000 - 1000) {
          Serial.printf("[cloud] checking earlier, in %s (%s)\n", formatWait(static_cast<uint32_t>(in / 1000)).c_str(), why);
        }
      }

      const bool asked = beatSoon_.exchange(false);
      const String ip = WiFi.localIP().toString();
      if (asked || !b.tried || ip != b.ip || uptimeMs() >= b.dueMs) {
        const bool ok = sendHeartbeat();
        b.tried = true;
        b.ip = ip;
        b.dueMs = uptimeMs() + (ok ? timing::HEARTBEAT_MS : timing::HEARTBEAT_RETRY_MS);
      }

      ota::service();  // remote update reports and installs; a download blocks this task for a while
    }

    // Sleep until something is due, a notification (pollSoon, Wi-Fi joined)
    // comes in, or the next housekeeping tick for ota::service().
    const char *why = "";
    const int64_t untilCheck = msUntilCheck(s, why);
    portENTER_CRITICAL(&mux_);
    shownAtMs_ = uptimeMs() + untilCheck;
    shownWhy_ = why;
    portEXIT_CRITICAL(&mux_);

    int64_t waitMs = timing::CLOUD_TICK_MS;
    if (online) {
      if (untilCheck < waitMs) waitMs = untilCheck;
      const int64_t untilBeat = b.dueMs - uptimeMs();
      if (untilBeat < waitMs) waitMs = untilBeat;
    }
    if (waitMs < 1) waitMs = 1;
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(static_cast<uint32_t>(waitMs)));  // waitMs <= 1000: no tick overflow
  }
}

}  // namespace

int postJson(const String &path, const String &body) { return request(true, path, body, false).code; }

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
  TaskHandle_t t = nullptr;
  if (xTaskCreatePinnedToCore(task, "cloud", 16384, nullptr, 1, &t, 0) == pdPASS) task_ = t;
}

bool running() { return task_ != nullptr; }

void pollSoon() {
  pollSoon_ = true;
  wake();
}

void wifiConnected() {
  beatSoon_ = true;
  pollSoon_ = true;
  wake();
}

NextCheck nextCheck() {
  NextCheck n{running(), 0, ""};
  if (!n.running) return n;
  int64_t at;
  portENTER_CRITICAL(&mux_);
  at = shownAtMs_;
  n.why = shownWhy_;
  portEXIT_CRITICAL(&mux_);
  if (pollSoon_) n.why = "asked to check now";
  const int64_t in = pollSoon_ ? 0 : at - uptimeMs();
  n.inMs = in < 0 ? 0 : in;
  return n;
}

}  // namespace cloud
