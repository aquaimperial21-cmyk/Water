// Commands typed into the USB serial monitor (115200 baud). Used by the
// technician to set the serial and token, and for testing. Type "help".

#pragma once

#include <Arduino.h>

namespace console {

void begin(const String &hostName);
void loop();
void printStatus();

}  // namespace console
