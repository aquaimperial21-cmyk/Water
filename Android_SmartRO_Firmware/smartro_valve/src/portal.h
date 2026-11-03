// Wi-Fi setup hotspot. The purifier opens an open network "SmartRO-Setup-xxxxxx";
// join it from a phone, a setup page pops up, pick the home Wi-Fi and type its
// password. The purifier saves it and restarts onto that Wi-Fi.

#pragma once

#include <DNSServer.h>
#include <WebServer.h>

namespace portal {

// canTimeOut: there is a working Wi-Fi saved, so give up after 10 minutes and go back to it.
void begin(WebServer &server, DNSServer &dns, const String &apName, bool canTimeOut);
void loop();

}  // namespace portal
