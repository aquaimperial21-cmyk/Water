# ESP32 firmware integration

The ESP32 inside each ImperialAqua purifier polls the backend for the current
subscription state and opens / closes its solenoid valve based on the response.
This document describes the wire protocol and provides a starter sketch.

## Identity & auth

Each device is paired in the warehouse:

1. Admin opens the device row in `/admin` and taps **Issue token**, hitting
   `POST /api/v1/devices/admin/:serial/issue-token` (ADMIN-auth). The response
   returns a 32-character base64url token that's also persisted on the
   `Device.deviceToken` column.
2. The token is flashed into the ESP32 alongside the device serial. Together
   they're the only credentials the device ever uses.
3. There's no JWT, no refresh — the token is long-lived and only rotates if
   admin re-issues. To revoke a device in the field, admin re-issues a new
   token (which invalidates any cached old one) and the firmware fetches the
   new one over OTA or a paired-mode QR scan.

All device endpoints accept the token via either query param `?token=…` or
HTTP header `X-Device-Token`.

## Endpoints

### `GET /api/v1/devices/:serial/state`

Polled by firmware (recommended cadence: once per 5 minutes, plus once
immediately on boot and Wi-Fi reconnect).

Request:

```
GET /api/v1/devices/IA-PP-08821/state?token=Xy7…2kQ HTTP/1.1
Host: api.imperialaqua.in
```

Response (200):

```json
{
  "data": {
    "allowFlow": true,
    "status": "ACTIVE",
    "expiresAt": "2026-10-26T04:06:31.265Z",
    "graceDays": 0,
    "message": null,
    "serverTime": "2026-04-29T06:11:02.912Z"
  }
}
```

Behaviour:

- `allowFlow=true` → open solenoid, allow water through filter.
- `allowFlow=false` → close solenoid. `message` carries a human reason
  (`"No active subscription"`, `"Subscription SUSPENDED"`, etc.) which the
  firmware can surface on its OLED display.
- `status` mirrors `Subscription.status` (`ACTIVE | GRACE | SUSPENDED |
  CLOSED`). When `NO_SUBSCRIPTION`, the device is paired but unassigned.
- `graceDays` is configurable via `DEVICE_GRACE_DAYS` env on the backend
  (default 0). Useful to keep flow on for a small window after expiry.

### `POST /api/v1/devices/:serial/heartbeat`

Posted by firmware every 30 minutes to mark the device alive. Updates
`Device.lastHeartbeatAt`, surfaced in the admin customer-360 view as the
"Online / Offline" pill (online = heartbeat within 90 minutes).

Request:

```
POST /api/v1/devices/IA-PP-08821/heartbeat?token=Xy7…2kQ HTTP/1.1
Content-Type: application/json

{
  "firmwareVersion": "1.4.2",
  "wifiSsid": "Customer-Home"
}
```

Response (200):

```json
{ "data": { "lastHeartbeatAt": "…", "firmwareVersion": "1.4.2", "wifiSsid": "Customer-Home" } }
```

## Failure modes

| Server says… | Firmware should… |
|---|---|
| HTTP 401 invalid token | Beep + display "Pairing required". Stop polling for 60 min. |
| HTTP 404 device not found | Same as 401. Means it was wiped server-side. |
| HTTP 5xx | Keep last cached state for up to 12h, retry with backoff. After 12h with no successful poll, close the valve as a fail-safe. |
| Network down | Keep last `allowFlow` for the cached `expiresAt` window. After expiry with no fresh poll, close the valve. |

## Sample sketch (Arduino IDE / PlatformIO, ESP32-WROOM)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

const char* WIFI_SSID = "Customer-Home";
const char* WIFI_PASS = "********";

const char* API_BASE  = "https://api.imperialaqua.in/api/v1";
const char* SERIAL_NO = "IA-PP-08821";
const char* TOKEN     = "REPLACE_WITH_DEVICE_TOKEN";

const int VALVE_PIN = 26;        // GPIO driving solenoid relay
const unsigned long POLL_MS      = 5UL * 60UL * 1000UL;
const unsigned long HEARTBEAT_MS = 30UL * 60UL * 1000UL;

unsigned long lastPoll      = 0;
unsigned long lastHeartbeat = 0;
bool allowFlow              = false;
unsigned long lastSuccess   = 0;

void setup() {
  Serial.begin(115200);
  pinMode(VALVE_PIN, OUTPUT);
  digitalWrite(VALVE_PIN, LOW); // fail-safe closed

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("WiFi connected");
}

void applyState(bool flow) {
  allowFlow = flow;
  digitalWrite(VALVE_PIN, flow ? HIGH : LOW);
}

void pollState() {
  HTTPClient http;
  String url = String(API_BASE) + "/devices/" + SERIAL_NO + "/state?token=" + TOKEN;
  http.begin(url);
  int code = http.GET();
  if (code == 200) {
    StaticJsonDocument<512> doc;
    auto err = deserializeJson(doc, http.getStream());
    if (!err) {
      bool flow = doc["data"]["allowFlow"] | false;
      applyState(flow);
      lastSuccess = millis();
    }
  } else if (code == 401 || code == 404) {
    applyState(false);
  }
  http.end();
}

void sendHeartbeat() {
  HTTPClient http;
  String url = String(API_BASE) + "/devices/" + SERIAL_NO + "/heartbeat?token=" + TOKEN;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  String body = "{\"firmwareVersion\":\"1.4.2\",\"wifiSsid\":\"" + String(WIFI_SSID) + "\"}";
  http.POST(body);
  http.end();
}

void loop() {
  unsigned long now = millis();
  if (now - lastPoll > POLL_MS || lastPoll == 0) {
    pollState();
    lastPoll = now;
  }
  if (now - lastHeartbeat > HEARTBEAT_MS || lastHeartbeat == 0) {
    sendHeartbeat();
    lastHeartbeat = now;
  }
  // Fail-safe: if no successful poll in 12h, close the valve.
  if (lastSuccess > 0 && (now - lastSuccess) > 12UL * 60UL * 60UL * 1000UL) {
    applyState(false);
  }
  delay(1000);
}
```

## Smoke-testing without hardware

Use curl to simulate a device:

```bash
SERIAL=IA-PP-08821
TOKEN=…  # from POST /admin/:serial/issue-token

# Read state
curl "http://localhost:4000/api/v1/devices/$SERIAL/state?token=$TOKEN"

# Heartbeat
curl -X POST "http://localhost:4000/api/v1/devices/$SERIAL/heartbeat?token=$TOKEN" \
  -H 'content-type: application/json' \
  -d '{"firmwareVersion":"sim-0.1","wifiSsid":"Test"}'
```

Force-suspend a subscription via admin and the next `state` call should
return `allowFlow:false`.
