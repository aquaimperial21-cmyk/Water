# ESP32 firmware integration

The ESP32 inside each ImperialAqua purifier polls the backend for the current
subscription state and opens / closes its solenoid valve based on the response.
On the home Wi-Fi it also takes ON/OFF commands straight from the customer app.
This document describes both wire protocols.

## Identity & auth

Each device is paired in the warehouse:

1. Allocating the device on the admin **Dispatch** page issues a token and
   shows it once with the serial. Later, the **Token** action on the
   **Devices** page shows it again (`GET /api/v1/devices/admin/:serial/token`,
   ADMIN-auth, audited as `DEVICE_TOKEN_VIEW`) and can generate a new one
   (`POST /api/v1/devices/admin/:serial/issue-token`, audited as
   `DEVICE_TOKEN_ISSUE`). The token is a 32-character base64url string stored
   on `Device.deviceToken`. No other API response includes it; they carry
   `hasToken` instead.
2. The token is flashed into the ESP32 alongside the device serial. Together
   they're the only credentials the device ever uses.
3. There's no JWT, no refresh — the token is long-lived and only rotates if
   admin re-issues. To revoke a device in the field, admin re-issues a new
   token (which invalidates any cached old one). A technician then types the
   new one into the ESP32 over USB (`token <TOKEN>`, then `reboot`; see the
   firmware README).

All device endpoints accept the token via either query param `?token=…` or
HTTP header `X-Device-Token`.

## Endpoints

### `GET /api/v1/devices/:serial/state`

Polled by firmware on the schedule the server sends in `pollIntervalSec`
(see [How often the purifier checks](#how-often-the-purifier-checks)), plus
once immediately on boot and Wi-Fi reconnect.

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
    "pollIntervalSec": 3600,
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
- `pollIntervalSec` is how many seconds to wait before the next poll. It is
  always a whole number from 30 to 3600. The firmware obeys it, clamped to
  that range, and waits 5 minutes if the field is missing.

#### How often the purifier checks

The server picks `pollIntervalSec` from the plan:

| Plan | Next check |
|---|---|
| Paid, more than 3 days left | every 1 hour (3600 s) |
| Last 3 days before the end (the reminder period) | every 15 minutes (900 s), plus one check right at the end time (`expiresAt + graceDays`) |
| Ended less than 24 hours ago, waiting for recharge | every 1 minute (60 s) |
| Ended 1–7 days ago | every 5 minutes (300 s) |
| Ended more than 7 days ago | every 15 minutes (900 s) |
| Paused | every 5 minutes (300 s) |
| Suspended or closed | every 30 minutes (1800 s) |
| No plan attached | every 1 hour (3600 s) |

Why water still stops on time: the firmware saves the plan's end time
(`expiresAt + graceDays`) and closes the valve by itself at that moment, even
with no internet. Frequent checks are not what stops the water. They only
bring news: a recharge, or admin stopping a plan. The check at the end time
means a recharge made just before expiry is seen about 5 seconds after the
end, so the water pauses for a few seconds at most. A recharge right after the end brings water back within about a minute;
after a long lapse, within about 15 minutes. An admin cancel or suspend
reaches a purifier at its next check, so within about an hour at most.

To make a purifier check at once, unplug its power for a few seconds and plug
it back in. It checks the server as soon as it is back on Wi-Fi. This is
handy right after installation or allocation, or to pick up a recharge or an
admin change without waiting.

The heartbeat (below) is separate and still goes every 30 minutes.

Load example: 100 purifiers used to make about 149,000 requests a day (a
check every 60 s, plus heartbeats). On this schedule it is roughly 8,000.

### `POST /api/v1/devices/:serial/heartbeat`

Posted by firmware every 30 minutes, and right after it gets an IP (boot,
Wi-Fi reconnect) so a DHCP change reaches the app quickly. Updates
`Device.lastHeartbeatAt`, surfaced in the admin customer-360 view as the
"Online / Offline" pill (online = heartbeat within 90 minutes).

Request:

```
POST /api/v1/devices/IA-PP-08821/heartbeat?token=Xy7…2kQ HTTP/1.1
Content-Type: application/json

{
  "firmwareVersion": "1.4.2",
  "wifiSsid": "Customer-Home",
  "localIp": "192.168.1.50"
}
```

Every field is optional; a missing one keeps the previous value. `localIp` is
the ESP32's address on the home LAN, as a dotted IPv4 string (anything else
is a 400). The customer app uses it for local Wi-Fi control (below).

Response (200):

```json
{ "data": { "lastHeartbeatAt": "…", "firmwareVersion": "1.4.2", "wifiSsid": "Customer-Home", "localIp": "192.168.1.50", … } }
```

## Remote firmware updates (OTA)

Images are signed on the release PC (`Android_SmartRO_Firmware/tools/release.mjs`):
ECDSA P-256 over SHA-256 of the exact `.bin` bytes, DER signature in base64,
`sha256` in lowercase hex. The server checks every upload against
`keys/firmware-signing-public.pem` (override: `FIRMWARE_PUBKEY_PATH`), and
the chip checks the signature again before it boots the new image.

**Offer.** Every `/state` poll may send `X-Firmware-Version: <running
version>` (1–40 of `A-Z a-z 0-9 . _ + -`; anything else is ignored). The
server stores it as `Device.firmwareVersion`, and marks the update
`INSTALLED` when it equals the offered release. The response then carries

```json
"firmware": { "id": "<releaseId>", "version": "1.1.0", "size": 1395136,
              "sha256": "<hex>", "signature": "<base64 DER>", "installNow": false,
              "retryGen": 0 }
```

only when a release is rolled out to the unit (`ALL`, or `TEST` with its
serial listed; the newest one wins), its version differs from the running
one, and the unit has not already failed or rolled it back 3 times.
Otherwise the key is absent. `retryGen` goes up by one each time an admin
presses Retry for the unit; the chip keeps its own try count per release and
resets it when `retryGen` changes.

**Download.** `GET /api/v1/devices/:serial/firmware/:releaseId` (device
token) streams the image as `application/octet-stream` with an exact
`Content-Length` (Range requests work). 404 unless the release is rolled out
to the unit or is the one it was offered. Images are never served from the
public `/uploads/...` path.

**Progress.** `POST /api/v1/devices/:serial/ota-report` (device token)

```json
{ "releaseId": "…", "status": "DOWNLOADING|FAILED|INSTALLED|ROLLED_BACK", "error": "≤200 chars", "version": "1.0.0" }
```

`FAILED` and `ROLLED_BACK` count an attempt; after 3 `FAILED` the release is
no longer offered to that unit until an admin presses retry. `INSTALLED`
clears the error. Each report is audited as `DEVICE_OTA_<STATUS>`. Answer:
`{ "data": { "ok": true } }`; unknown `releaseId` is a 404.

**Admin** (`/api/v1/firmware/admin/...`, ADMIN JWT; the console's Firmware
page): `POST releases` (multipart `file`, `manifest`, optional `notes`;
starts with rollout `OFF`), `GET releases` (with fleet counts), `PATCH
releases/:id` (`rollout`, `testSerials`, `installNow`, `notes`), `GET
devices`, `POST devices/:serial/retry`.

**Without the console**, inside the API container:

```bash
docker compose exec api npm run firmware:add -- /tmp/fw.bin /tmp/fw.release.json "notes"
docker compose exec api npm run firmware:rollout -- 1.1.0 TEST SR-AP-000105,SR-AP-000106
docker compose exec api npm run firmware:rollout -- 1.1.0 ALL --now
```

(copy the files in first with `docker compose cp <file> api:/tmp/`).

## Failure modes

The firmware saves the last `/state` answer in flash, so a reboot does not
lose it. A fresh 200 always replaces it.

| Server says… | Firmware should… |
|---|---|
| HTTP 401 invalid token | Close the valve and show "Pairing required". The token was re-issued or the pairing removed. |
| HTTP 404 device not found | Same as 401. Means it was wiped server-side. |
| HTTP 5xx, timeout, network down | Keep the last saved answer and retry with backoff. If it allowed flow, water stays on until `expiresAt + graceDays` by the device clock, then the valve closes. |
| Clock unknown (power cut, then no internet / NTP) | Keep the valve closed until the clock is set or a fresh answer arrives. |

## Local Wi-Fi control

When the phone and the purifier are on the same home Wi-Fi, the customer app
turns the water on and off by talking straight to the ESP32, with no cloud
round trip. The ESP32 still polls `/state` as above.

The business rule does not change: the ESP32 is what cuts water on an unpaid
plan. Local OFF always works. Local ON works only while the plan allows flow,
which the ESP32 decides from its last `/state` answer and its clock. The app
can never force water on: the valve is open only when the customer's switch
is on *and* the plan allows it.

### Local key

```
localKey = lowercase hex( HMAC-SHA256( key = UTF-8 bytes of deviceToken,
                                       msg = "smartro-local-v1" ) )
```

64 hex characters. The ESP32 derives it from the token flashed onto it, the
backend from `Device.deviceToken` (`localKeyFor()` in
`src/core/device-token.ts`), and the app fetches it from the backend and
caches it. Re-issuing the device token in admin changes the key too.

Test vector (seed device SR-AP-000101):

```
deviceToken = devtok-demo-priya-aquapure-7l
localKey    = 8ba08c6faf0f3d8d680f1fcf28be99fb015232bec893257c24a5c1496d251a14
```

### `GET /api/v1/devices/me/local-access`

Customer JWT. Returns the device on the caller's latest subscription that has
one, whatever the subscription's status, since OFF must keep working on a
lapsed plan. Sent with `Cache-Control: no-store`. The device token itself is
never returned.

```json
{
  "data": {
    "serial": "SR-AP-000101",
    "localIp": "192.168.1.50",
    "localKey": "8ba08c6f…251a14",
    "lastHeartbeatAt": "2026-11-03T09:12:44.120Z",
    "isOnline": true
  }
}
```

- `{ "data": null }` → no device paired.
- `localIp` is `null` until a heartbeat reports one.
- `localKey` is `null` while the device has no token.
- `isOnline` = heartbeat within 90 minutes.

### Command signature (app → ESP32)

```
sig = lowercase hex( HMAC-SHA256( key = UTF-8 bytes of the 64-char localKey hex string,
                                  msg = "valve:" + ("1" if on else "0") + ":" + nonce ) )
```

The HMAC key is the hex *string*, not the 32 bytes it decodes to.

Test vector (localKey above, nonce `00112233445566778899aabbccddeeff`):

```
on=true  → fc8615c0b84cb9a50569256a39e8885261848b2993c5cc75414d04ce75e3db83
on=false → 390b527f3af3fc868c7ba00ba15b0081cb5e3b755377ecb05eb2fe093e24583a
```

### ESP32 local HTTP API (port 80 on the home LAN)

Every response is JSON with these headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Private-Network: true
Cache-Control: no-store
```

`OPTIONS <any>` → 204 with those headers. Errors are
`{ "error": "<code>", "message": "<human text>" }`.

**`GET /api/status`** (no auth) → 200:

```json
{
  "api": 1,
  "serial": "SR-AP-000101",
  "fw": "1.0.0",
  "valveOpen": true,
  "wantOn": true,
  "planAllows": true,
  "planStatus": "ACTIVE",
  "planUntil": "2027-05-02T04:06:31Z",
  "timeKnown": true,
  "cloudOk": true,
  "lastCloudSecAgo": 42,
  "message": null,
  "ip": "192.168.1.50",
  "ssid": "HomeWiFi",
  "rssi": -55
}
```

- `valveOpen` = water is flowing now; always `wantOn && planAllows`.
- `wantOn` = the customer's switch, saved across reboots (default `true`).
- `planAllows` = plan paid per the last server answer and the clock.
- `planStatus` = the server's status string, `"UNKNOWN"` before the first answer.
- `planUntil` = `expiresAt + graceDays`, or `null`.
- `cloudOk` = the last server poll succeeded; `lastCloudSecAgo` may be `null`.
- `message` = text to show the customer, or `null`.

**`GET /api/nonce`** (no auth) → 200 `{ "nonce": "<32 lowercase hex>", "ttlSec": 60 }`.
Single use, expires after 60 s. The ESP32 keeps the last 8.

**`POST /api/valve`** with body `{ "on": true, "nonce": "<from /api/nonce>", "sig": "<signature>" }`.
The app sends it as `Content-Type: text/plain` to skip a CORS preflight on
web; the ESP32 ignores Content-Type.

| Status | Body | Meaning |
|---|---|---|
| 200 | same object as `/api/status`, after applying | done |
| 400 | `{ "error": "bad_request" }` | malformed JSON or missing fields |
| 401 | `{ "error": "bad_nonce" }` | unknown, used or expired nonce; the app gets a new nonce and retries once |
| 401 | `{ "error": "bad_signature" }` | wrong key; the app refetches `localKey` from the backend |
| 403 | `{ "error": "plan_inactive", "message": "Your plan is not active. Recharge to turn the water on." }` | only for `on=true`; `wantOn` is not changed. If the last server check is over 30 s old, the ESP32 checks again at once, so a fresh recharge works on the next tap |
| 503 | `{ "error": "not_provisioned" }` | the ESP32 has no serial / token yet |

The ESP32 also advertises mDNS `smartro-<last 6 hex of MAC>.local` and the
service `_smartro._tcp`. This is informational: the app uses `localIp` from
the backend, with manual IP entry as a fallback.

## Firmware

The real firmware is the PlatformIO project at
`Android_SmartRO_Firmware/smartro_valve`. Build, flash and provisioning steps
are in its README.

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
  -d '{"firmwareVersion":"sim-0.1","wifiSsid":"Test","localIp":"192.168.1.50"}'

# What the customer app gets for local control (customer JWT)
curl "http://localhost:4000/api/v1/devices/me/local-access" \
  -H "authorization: Bearer $CUSTOMER_JWT"
```

Force-suspend a subscription via admin and the next `state` call should
return `allowFlow:false`.
