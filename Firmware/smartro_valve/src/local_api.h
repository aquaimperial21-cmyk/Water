// The purifier's own small web API on the home Wi-Fi. The SmartRO app calls it
// directly when the phone is on the same network.
//
//   GET  /api/status   current state (no key needed)
//   GET  /api/nonce    one-time code for the next command
//   POST /api/valve    {"on":bool,"nonce":"...","sig":"..."}  turn water on/off
//                      sig = hex HMAC-SHA256(localKey, "valve:<1|0>:<nonce>")
//   POST /api/refresh  {"nonce":"...","sig":"..."}  check the server now
//                      sig = hex HMAC-SHA256(localKey, "refresh:<nonce>")
//                      200 {"ok":true,"queued":true}; at most once per 10 s,
//                      else 429 {"error":"too_soon","message","retryAfterSec"}
//
// The signature proves the app holds this purifier's local key (the server
// gives it to the purifier's owner). Each nonce works once, for 60 s. OFF
// always works. ON only works while the plan allows it. A refresh never
// changes the valve by itself: it only brings the next server check forward.

#pragma once

#include <WebServer.h>

namespace local_api {

void begin(WebServer &server);

}  // namespace local_api
