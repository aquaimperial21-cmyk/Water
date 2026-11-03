// Relay click test: relay ON for 5 seconds, OFF for 5 seconds, forever.
// No water and no 24V needed. Power the ESP32 from the laptop USB.
//
// Wiring:
//   relay DC+ (VCC) -> ESP32 VIN
//   relay DC- (GND) -> ESP32 GND
//   relay IN        -> ESP32 D26

#include <Arduino.h>

const int RELAY_PIN = 26;
const int LED_PIN = 2;  // blue LED on the ESP32 board, lights when relay is ON

// If the relay is ON while the blue LED is OFF, the relay is "low trigger":
// swap these two lines (ON = LOW, OFF = HIGH) and upload again.
const int RELAY_ON = HIGH;
const int RELAY_OFF = LOW;

const unsigned long ON_MS = 5000;
const unsigned long OFF_MS = 5000;

void setRelay(bool on) {
  digitalWrite(RELAY_PIN, on ? RELAY_ON : RELAY_OFF);
  digitalWrite(LED_PIN, on ? HIGH : LOW);
  Serial.println(on ? "Relay ON  -> water would flow" : "Relay OFF -> water would stop");
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  setRelay(false);
}

void loop() {
  setRelay(true);
  delay(ON_MS);
  setRelay(false);
  delay(OFF_MS);
}
