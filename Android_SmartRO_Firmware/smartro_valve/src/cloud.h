// Talks to the SmartRO server: polls the plan state and sends heartbeats.
// Runs in its own task so a slow HTTPS call never delays the app's commands.

#pragma once

namespace cloud {

// Starts the background task. Does nothing until the purifier has a serial and token.
void begin();

// Ask for a poll and heartbeat right away (after joining Wi-Fi or getting a new IP).
void pollSoon();

}  // namespace cloud
