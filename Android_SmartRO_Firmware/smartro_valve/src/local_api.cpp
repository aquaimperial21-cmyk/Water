#include "local_api.h"

#include <ArduinoJson.h>
#include <WiFi.h>

#include "cloud.h"
#include "config.h"
#include "ota.h"
#include "purifier.h"
#include "util.h"

namespace local_api {
namespace {

WebServer *srv = nullptr;

constexpr size_t NONCE_SLOTS = 8;
struct Nonce {
  char hex[33];
  uint32_t issuedMs;
  bool live;
};
Nonce nonces[NONCE_SLOTS] = {};
size_t nextSlot = 0;

void addCorsHeaders() {
  srv->sendHeader("Access-Control-Allow-Origin", "*");
  srv->sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  srv->sendHeader("Access-Control-Allow-Headers", "Content-Type");
  srv->sendHeader("Access-Control-Allow-Private-Network", "true");
  srv->sendHeader("Cache-Control", "no-store");
}

void sendJson(int code, const JsonDocument &doc) {
  String out;
  serializeJson(doc, out);
  addCorsHeaders();
  srv->send(code, "application/json", out);
}

void sendError(int code, const char *error, const String &message) {
  JsonDocument doc;
  doc["error"] = error;
  doc["message"] = message;
  sendJson(code, doc);
}

void sendStatus() {
  const purifier::Plan p = purifier::plan();
  JsonDocument doc;
  doc["api"] = 1;
  doc["serial"] = purifier::serial();
  doc["fw"] = FW_VERSION;
  doc["valveOpen"] = purifier::valveOpen();
  doc["wantOn"] = purifier::wantOn();
  doc["planAllows"] = purifier::planAllows();
  doc["planStatus"] = String(p.known ? p.status : "UNKNOWN");
  if (p.until) {
    doc["planUntil"] = formatIsoUtc(p.until);
  } else {
    doc["planUntil"] = nullptr;
  }
  doc["timeKnown"] = purifier::now() != 0;
  doc["cloudOk"] = purifier::cloudOk();
  const int32_t ago = purifier::lastCloudSecAgo();
  if (ago >= 0) {
    doc["lastCloudSecAgo"] = ago;
  } else {
    doc["lastCloudSecAgo"] = nullptr;
  }
  const String msg = purifier::customerMessage();
  if (msg.length()) {
    doc["message"] = msg;
  } else {
    doc["message"] = nullptr;
  }
  doc["ip"] = WiFi.localIP().toString();
  doc["ssid"] = WiFi.SSID();
  doc["rssi"] = WiFi.RSSI();
  ota::addStatusJson(doc["ota"].to<JsonObject>());
  sendJson(200, doc);
}

void handleNonce() {
  Nonce &n = nonces[nextSlot];
  nextSlot = (nextSlot + 1) % NONCE_SLOTS;
  const String hex = randomHex(16);
  strlcpy(n.hex, hex.c_str(), sizeof(n.hex));
  n.issuedMs = millis();
  n.live = true;

  JsonDocument doc;
  doc["nonce"] = hex;
  doc["ttlSec"] = timing::NONCE_TTL_MS / 1000;
  sendJson(200, doc);
}

// Single use: the nonce is spent even when the signature then turns out wrong.
// Every slot is compared in full, so the time taken doesn't hint at live nonces.
bool takeNonce(const String &hex) {
  if (hex.length() != 32) return false;
  const char *h = hex.c_str();
  Nonce *hit = nullptr;
  for (Nonce &n : nonces) {
    uint8_t diff = n.live ? 0 : 1;
    for (size_t i = 0; i < 32; i++) diff |= static_cast<uint8_t>(h[i] ^ n.hex[i]);
    if (diff == 0) hit = &n;
  }
  if (!hit) return false;
  hit->live = false;
  return millis() - hit->issuedMs <= timing::NONCE_TTL_MS;
}

// The nonce and signature of a signed command. False after answering with the error.
bool checkSigned(const JsonDocument &body, const String &message) {
  const String nonce = body["nonce"].as<const char *>();
  String sig = body["sig"].as<const char *>();
  sig.toLowerCase();
  if (!takeNonce(nonce)) {
    sendError(401, "bad_nonce", "That request expired. Try again.");
    return false;
  }
  const String expected = hmacSha256Hex(purifier::localKey(), message + nonce);
  if (!sameSecret(sig, expected)) {
    Serial.println("[app] rejected a command with a wrong signature");
    sendError(401, "bad_signature", "This phone doesn't have the right key for this purifier.");
    return false;
  }
  return true;
}

void handleValve() {
  if (!purifier::provisioned()) {
    sendError(503, "not_provisioned", "This purifier is not set up yet.");
    return;
  }

  JsonDocument body;
  const DeserializationError err = deserializeJson(body, srv->arg("plain"));
  if (err || !body["on"].is<bool>() || !body["nonce"].is<const char *>() || !body["sig"].is<const char *>()) {
    sendError(400, "bad_request", "Send on, nonce and sig.");
    return;
  }
  const bool on = body["on"].as<bool>();
  if (!checkSigned(body, String("valve:") + (on ? "1" : "0") + ":")) return;

  if (on && !purifier::planAllows()) {
    String msg = purifier::customerMessage();
    if (!msg.length()) msg = "Your plan is not active. Recharge to turn the water on.";
    Serial.println("[app] ON refused: the plan doesn't allow water right now");
    // The customer may have just recharged: ask the server again now instead of
    // at the next scheduled check, so the next tap can succeed.
    const int32_t ago = purifier::lastCloudSecAgo();
    if (ago < 0 || ago > 30) cloud::pollSoon();
    sendError(403, "plan_inactive", msg);
    return;
  }

  purifier::setWantOn(on);
  purifier::updateValve();
  Serial.printf("[app] water switched %s from the app\n", on ? "ON" : "OFF");
  sendStatus();
}

// The app just paused, resumed or recharged the plan: check the server now
// instead of at the next scheduled check (up to a day away). Only queues the
// check; the cloud task makes it. Never touches the valve.
void handleRefresh() {
  if (!purifier::provisioned()) {
    sendError(503, "not_provisioned", "This purifier is not set up yet.");
    return;
  }

  JsonDocument body;
  const DeserializationError err = deserializeJson(body, srv->arg("plain"));
  if (err || !body["nonce"].is<const char *>() || !body["sig"].is<const char *>()) {
    sendError(400, "bad_request", "Send nonce and sig.");
    return;
  }
  if (!checkSigned(body, "refresh:")) return;

  if (!cloud::running()) {
    sendError(503, "cloud_off", "This purifier doesn't check SmartRO (server checks are off in this build).");
    return;
  }

  static bool refreshedOnce = false;  // loop task only
  static int64_t lastRefreshMs = 0;
  const int64_t nowMs = uptimeMs();
  const int64_t sinceMs = nowMs - lastRefreshMs;
  if (refreshedOnce && sinceMs < static_cast<int64_t>(timing::REFRESH_MIN_GAP_MS)) {
    const uint32_t retrySec = static_cast<uint32_t>((timing::REFRESH_MIN_GAP_MS - sinceMs + 999) / 1000);
    JsonDocument doc;
    doc["error"] = "too_soon";
    doc["message"] = "The purifier is already checking SmartRO. Try again in a few seconds.";
    doc["retryAfterSec"] = retrySec;
    srv->sendHeader("Retry-After", String(retrySec));
    sendJson(429, doc);
    return;
  }
  refreshedOnce = true;
  lastRefreshMs = nowMs;
  cloud::pollSoon();
  Serial.println("[app] the app asked for a server check now");

  JsonDocument doc;
  doc["ok"] = true;
  doc["queued"] = true;
  sendJson(200, doc);
}

void handleRoot() {
  String html =
      "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>"
      "<title>SmartRO purifier</title></head><body style='font-family:sans-serif;padding:16px'>"
      "<h2>SmartRO purifier</h2><p>Serial: ";
  html += purifier::provisioned() ? purifier::serial() : String("not set up");
  html += "<br>Water: ";
  html += purifier::valveOpen() ? "ON" : "OFF";
  html += "<br>Firmware: " FW_VERSION "</p><p>Use the SmartRO app to turn the water on or off.</p>"
          "<p><a href='/api/status'>Status (JSON)</a></p></body></html>";
  addCorsHeaders();
  srv->send(200, "text/html", html);
}

void handleNotFound() {
  if (srv->method() == HTTP_OPTIONS) {  // CORS preflight from the web build of the app
    addCorsHeaders();
    srv->send(204);
    return;
  }
  sendError(404, "not_found", "No such page.");
}

}  // namespace

void begin(WebServer &server) {
  srv = &server;
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status", HTTP_GET, sendStatus);
  server.on("/api/nonce", HTTP_GET, handleNonce);
  server.on("/api/valve", HTTP_POST, handleValve);
  server.on("/api/refresh", HTTP_POST, handleRefresh);
  server.onNotFound(handleNotFound);
  server.begin();
}

}  // namespace local_api
