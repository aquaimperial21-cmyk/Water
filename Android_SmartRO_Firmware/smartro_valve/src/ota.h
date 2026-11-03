// Remote firmware updates (OTA). How releases are made and signed: ../OTA.md.
//
// The server offers an update in its /state answer. The purifier installs it
// only if the .bin's SHA-256 and ECDSA signature check out (ota_pubkey.h),
// at night (02:00-05:00 IST) unless the release says installNow.
//
// A new image boots "on trial". It is kept once the server answers a /state
// request. A crash or restart before that, or 10 minutes of Wi-Fi without an
// answer, puts the previous firmware back. Nothing here touches the valve.
//
// The download runs in the cloud task, so the loop (valve, local API,
// console) keeps running throughout. Server checks pause while it runs.

#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

namespace ota {

// Once in setup(), before Wi-Fi: reads the saved OTA state and works out
// whether this boot is a trial of a new update or follows a rollback.
void begin();

// Loop task, every pass. Keeps a trial image once the server has answered;
// rolls it back after 10 minutes of Wi-Fi without an answer.
void loop();

// ── Cloud task only ─────────────────────────────────────────────────────────
// The /state answer's data.firmware object (null when none is offered).
void handleOffer(JsonObjectConst firmware);
// A /state answer was read successfully.
void onStateOk();
// Each cloud-task pass while Wi-Fi is up: sends reports, installs when due.
// Blocks for the download (a minute or two); restarts the chip on success.
void service();

// ── Any task ────────────────────────────────────────────────────────────────
// Console "ota now": the offered update may skip the night window (and the
// retry wait) once. Returns what to tell the technician.
String requestNow();
// One line for the console "status".
String statusLine();
// Console "ota".
void printDetail();
// Fills the "ota" object of the local /api/status.
void addStatusJson(JsonObject o);

}  // namespace ota
