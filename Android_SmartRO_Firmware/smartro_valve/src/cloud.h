// Talks to the SmartRO server: polls the plan state and sends heartbeats.
// Runs in its own task so a slow HTTPS call never delays the app's commands.
// Remote updates (ota.cpp) run in this task too.

#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>

namespace cloud {

// Starts the background task. Does nothing until the purifier has a serial and token.
void begin();

// Ask for a poll and heartbeat right away (after joining Wi-Fi or getting a new IP).
void pollSoon();

// ── For ota.cpp (cloud task only) ───────────────────────────────────────────
// Sets up http for API_BASE + path the way every server call is made: only
// Let's Encrypt roots for https (and https only in production builds), the
// device token and firmware version headers, timeouts. False when refused.
bool beginRequest(HTTPClient &http, NetworkClientSecure &secure, NetworkClient &plain, const String &path,
                  uint16_t readTimeoutMs);

// POSTs a JSON body to API_BASE + path. Returns the HTTP status, < 0 without an answer.
int postJson(const String &path, const String &body);

}  // namespace cloud
