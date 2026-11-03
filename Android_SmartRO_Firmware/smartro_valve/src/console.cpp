#include "console.h"

#include <WiFi.h>

#include "config.h"
#include "purifier.h"
#include "util.h"

namespace console {
namespace {

String line;
String host;

void printHelp() {
  Serial.println(
      "\nCommands:\n"
      "  status                 show everything\n"
      "  serial <SERIAL>        set the device serial, e.g. serial SR-AP-000101\n"
      "  token <TOKEN>          set the device token from the admin Dispatch/Devices page\n"
      "  ssid <name>            set the home Wi-Fi name (spaces allowed)\n"
      "  pass <password>        set the home Wi-Fi password (empty = open network)\n"
      "  setup                  open the Wi-Fi setup hotspot (same as holding BOOT 5 s)\n"
      "  wifi-forget            delete the saved Wi-Fi\n"
      "  on | off               the customer's water switch (ON still needs an active plan)\n"
      "  reboot                 restart (serial/token/Wi-Fi changes apply after this)\n"
      "  factory-reset yes      wipe serial, token, Wi-Fi and the saved plan\n");
}

// The typed line without leading spaces. Trailing spaces stay: they can be part of a password.
String cmd;

String restAfter(const String &word) {
  // Everything after "word ", keeping inner spaces.
  if (cmd.length() <= word.length()) return String();
  return cmd.substring(word.length() + 1);
}

void handle() {
  cmd = line;
  while (cmd.length() && cmd[0] == ' ') cmd.remove(0, 1);
  const int space = cmd.indexOf(' ');
  String word = space < 0 ? cmd : cmd.substring(0, space);
  word.toLowerCase();

  if (word == "help" || word == "?") {
    printHelp();
  } else if (word == "status") {
    printStatus();
  } else if (word == "serial") {
    String s = restAfter("serial");
    s.trim();
    if (purifier::saveSerial(s)) {
      Serial.printf("Saved serial %s. Type reboot to use it.\n", s.c_str());
    } else {
      Serial.println("Serial must be 1-40 letters, digits, - or _.");
    }
  } else if (word == "token") {
    String t = restAfter("token");
    t.trim();
    if (purifier::saveToken(t)) {
      Serial.println("Saved token. Type reboot to use it.");
    } else {
      Serial.println("Token must be 8-128 characters with no spaces.");
    }
  } else if (word == "ssid") {
    String s = restAfter("ssid");
    s.trim();
    if (s.isEmpty() || s.length() > 32) {
      Serial.println("Wi-Fi name must be 1-32 characters.");
    } else {
      purifier::WifiSettings w = purifier::loadWifi();
      purifier::saveWifi(s, w.pass);
      Serial.printf("Saved Wi-Fi name \"%s\". Now: pass <password>, then reboot.\n", s.c_str());
    }
  } else if (word == "pass") {
    const String p = restAfter("pass");  // not trimmed: spaces can be part of a password
    if (p.length() != 0 && (p.length() < 8 || p.length() > 63)) {
      Serial.println("Wi-Fi passwords are 8-63 characters (or empty for an open network).");
    } else {
      purifier::WifiSettings w = purifier::loadWifi();
      purifier::saveWifi(w.ssid, p);
      Serial.println("Saved Wi-Fi password. Type reboot to join.");
    }
  } else if (word == "setup") {
    purifier::requestSetupOnBoot();
    Serial.println("Opening Wi-Fi setup...");
    delay(200);
    ESP.restart();
  } else if (word == "wifi-forget") {
    purifier::forgetWifi();
    Serial.println("Wi-Fi forgotten. Type reboot to open the setup hotspot.");
  } else if (word == "on" || word == "off") {
    purifier::setWantOn(word == "on");
    purifier::updateValve();
    if (word == "on" && !purifier::valveOpen()) {
      Serial.printf("Switch is ON, but the water stays off: %s\n", purifier::customerMessage().c_str());
    } else {
      Serial.printf("Water is %s.\n", purifier::valveOpen() ? "ON" : "OFF");
    }
  } else if (word == "reboot" || word == "restart") {
    Serial.println("Restarting...");
    delay(200);
    ESP.restart();
  } else if (word == "factory-reset") {
    String confirm = restAfter("factory-reset");
    confirm.trim();
    if (confirm == "yes") {
      purifier::factoryReset();
      Serial.println("Wiped. Restarting...");
      delay(200);
      ESP.restart();
    } else {
      Serial.println("Type: factory-reset yes");
    }
  } else if (word.length()) {
    Serial.printf("Unknown command \"%s\". Type help.\n", word.c_str());
  }
}

}  // namespace

void begin(const String &hostName) {
  host = hostName;
  line.reserve(200);
}

void loop() {
  while (Serial.available()) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\r' || c == '\n') {
      if (line.length()) handle();
      line = "";
    } else if (line.length() < 200) {
      line += c;
    }
  }
}

void printStatus() {
  const purifier::Plan p = purifier::plan();
  const uint32_t now = purifier::now();
  Serial.println("\n----- SmartRO purifier -----");
  Serial.printf("Firmware      %s\n", FW_VERSION);
  Serial.printf("Server        %s\n", API_BASE);
  Serial.printf("Serial        %s\n", purifier::serial().length() ? purifier::serial().c_str() : "(not set)");
  Serial.printf("Token         %s\n", purifier::maskedToken().c_str());
  if (purifier::localKey().length()) {
    Serial.printf("Local key     %s... (the app gets the same from the server)\n",
                  purifier::localKey().substring(0, 8).c_str());
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi         %s, signal %d dBm\n", WiFi.SSID().c_str(), WiFi.RSSI());
    Serial.printf("App address   http://%s/  or  http://%s.local/\n", WiFi.localIP().toString().c_str(), host.c_str());
  } else if (WiFi.getMode() & WIFI_AP) {
    Serial.printf("Wi-Fi         setup hotspot open: %s\n", WiFi.softAPSSID().c_str());
  } else {
    Serial.printf("Wi-Fi         not connected (saved: \"%s\")\n", purifier::loadWifi().ssid.c_str());
  }
  Serial.printf("Time (UTC)    %s\n", now ? formatIsoUtc(now).c_str() : "unknown");
  Serial.printf("Plan          %s, allowFlow=%s, until %s\n", p.known ? p.status : "never checked",
                p.allowFlow ? "true" : "false", p.until ? formatIsoUtc(p.until).c_str() : "-");
  const int32_t ago = purifier::lastCloudSecAgo();
  if (ago >= 0) {
    Serial.printf("Last server   %ld s ago (%s)\n", static_cast<long>(ago), purifier::cloudOk() ? "ok" : "last try failed");
  } else {
    Serial.println("Last server   no answer since boot");
  }
  Serial.printf("Switch        %s\n", purifier::wantOn() ? "ON" : "OFF");
  Serial.printf("Water         %s\n", purifier::valveOpen() ? "ON (valve open)" : "OFF (valve closed)");
  const String msg = purifier::customerMessage();
  if (msg.length()) Serial.printf("Note          %s\n", msg.c_str());
  Serial.println("----------------------------");
}

}  // namespace console
