// Talks to the SmartRO server: polls the plan state and sends heartbeats.
// Runs in its own task so a slow HTTPS call never delays the app's commands.
// Remote updates (ota.cpp) run in this task too.
//
// When it checks GET /state: when the server's pollIntervalSec says so (30 s
// to 1 day), and earlier when any of these comes first:
//   - Wi-Fi (re)connects, or pollSoon() is called (the app's /api/refresh,
//     the console "refresh", an ON refused while the plan looks unpaid, an
//     update offer that needs a fresh look);
//   - just after the saved plan ends (a recharge made at the last minute);
//   - this purifier's night-window minute (an update released during the day).
// Between checks the task sleeps on a FreeRTOS notification, so pollSoon()
// wakes it at once; it also wakes every second for update housekeeping.

#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>

namespace cloud {

// Starts the background task. Does nothing until the purifier has a serial and token.
void begin();

// True when the background task runs (serial and token set, server address allowed).
bool running();

// Any task, never blocks: check GET /state as soon as possible, skipping the
// rest of the wait. Several calls before the check still make one check.
void pollSoon();

// Any task, never blocks: Wi-Fi joined or rejoined. Checks the server and
// sends a heartbeat (the app finds the purifier by the IP the server stored).
void wifiConnected();

// For the console "status".
struct NextCheck {
  bool running;    // false: no server checks at all (not provisioned)
  int64_t inMs;    // until the next GET /state; 0 = due now (or as soon as Wi-Fi is up)
  const char *why; // "server schedule", "night update window", ...
};
NextCheck nextCheck();

// ── For ota.cpp (cloud task only) ───────────────────────────────────────────
// Sets up http for API_BASE + path the way every server call is made: only
// Let's Encrypt roots for https (and https only in production builds), the
// device token and firmware version headers, timeouts. False when refused.
bool beginRequest(HTTPClient &http, NetworkClientSecure &secure, NetworkClient &plain, const String &path,
                  uint16_t readTimeoutMs);

// POSTs a JSON body to API_BASE + path. Returns the HTTP status, < 0 without an answer.
int postJson(const String &path, const String &body);

}  // namespace cloud
