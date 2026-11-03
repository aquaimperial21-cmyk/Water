// Build settings and pins. API_BASE and FW_VERSION come from platformio.ini.

#pragma once

#include <Arduino.h>

#ifndef FW_VERSION
#define FW_VERSION "dev"
#endif

#ifndef API_BASE
#error "API_BASE is not set. Build the lan or production env from platformio.ini."
#endif

#ifndef RELAY_ACTIVE_LOW
#define RELAY_ACTIVE_LOW 0
#endif

#ifndef REQUIRE_HTTPS
#define REQUIRE_HTTPS 0
#endif

namespace pins {
constexpr int RELAY = 26;   // relay module IN (D26)
constexpr int LED = 2;      // blue LED on the board
constexpr int BUTTON = 0;   // BOOT button, reads LOW while pressed
}  // namespace pins

namespace timing {
// Hold BOOT this long to open the Wi-Fi setup hotspot.
constexpr uint32_t SETUP_HOLD_MS = 5000;
// When setup was opened on purpose and nobody finishes it, go back to the saved Wi-Fi.
constexpr uint32_t SETUP_TIMEOUT_MS = 10UL * 60UL * 1000UL;
// A Wi-Fi network that has never worked gets this long before setup reopens.
constexpr uint32_t FIRST_JOIN_TIMEOUT_MS = 45UL * 1000UL;
// Heartbeat: once after boot, after every Wi-Fi (re)connect or IP change, and
// at least this often. Every /state check also sends the IP (X-Local-Ip).
constexpr uint32_t HEARTBEAT_MS = 24UL * 60UL * 60UL * 1000UL;
// A failed heartbeat is tried again after this long.
constexpr uint32_t HEARTBEAT_RETRY_MS = 10UL * 60UL * 1000UL;
// Poll cadence when the server doesn't send pollIntervalSec.
constexpr uint32_t DEFAULT_POLL_SEC = 300;
// The server's pollIntervalSec is kept inside this range (about once a day while paid).
constexpr uint32_t POLL_MIN_SEC = 30;
constexpr uint32_t POLL_MAX_SEC = 86400;
// A check is also timed this long after the plan's end, to see a last-minute recharge.
constexpr uint32_t PLAN_END_MARGIN_SEC = 5;
// The cloud task wakes at least this often for update housekeeping (ota::service).
constexpr uint32_t CLOUD_TICK_MS = 1000;
// The app's POST /api/refresh works at most once per this long.
constexpr uint32_t REFRESH_MIN_GAP_MS = 10UL * 1000UL;
// After the server says the token or serial is wrong.
constexpr uint32_t PAIRING_RETRY_SEC = 15UL * 60UL;
// Retry after a failed poll: starts here and doubles up to the max.
constexpr uint32_t RETRY_MIN_SEC = 30;
constexpr uint32_t RETRY_MAX_SEC = 600;
// Nonces handed to the app are good for this long.
constexpr uint32_t NONCE_TTL_MS = 60UL * 1000UL;
}  // namespace timing
