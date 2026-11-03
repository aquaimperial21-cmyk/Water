// The purifier's own small web API on the home Wi-Fi. The SmartRO app calls it
// directly when the phone is on the same network.
//
//   GET  /api/status   current state (no key needed)
//   GET  /api/nonce    one-time code for the next command
//   POST /api/valve    {"on":bool,"nonce":"...","sig":"..."}  turn water on/off
//
// The signature proves the app holds this purifier's local key (the server
// gives it to the purifier's owner). OFF always works. ON only works while
// the plan allows it.

#pragma once

#include <WebServer.h>

namespace local_api {

void begin(WebServer &server);

}  // namespace local_api
