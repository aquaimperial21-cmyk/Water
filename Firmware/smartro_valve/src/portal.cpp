#include "portal.h"

#include <WiFi.h>
#include <algorithm>
#include <vector>

#include "config.h"
#include "purifier.h"

namespace portal {
namespace {

WebServer *srv = nullptr;
DNSServer *dnsSrv = nullptr;
std::vector<String> networks;  // names from the last scan, strongest first
String errorText;              // shown above the form
String savedSsid;              // pre-fills the form
uint32_t startMs = 0;
uint32_t restartAtMs = 0;
bool timeOut = false;

String escapeHtml(const String &s) {
  String out;
  out.reserve(s.length() + 8);
  for (size_t i = 0; i < s.length(); i++) {
    const char c = s[i];
    switch (c) {
      case '&': out += "&amp;"; break;
      case '<': out += "&lt;"; break;
      case '>': out += "&gt;"; break;
      case '"': out += "&quot;"; break;
      case '\'': out += "&#39;"; break;
      default: out += c;
    }
  }
  return out;
}

void scan() {
  networks.clear();
  const int n = WiFi.scanNetworks();
  std::vector<std::pair<int, String>> found;
  for (int i = 0; i < n; i++) {
    const String name = WiFi.SSID(i);
    if (name.isEmpty()) continue;  // hidden network
    bool dup = false;
    for (auto &f : found) {
      if (f.second == name) {
        if (WiFi.RSSI(i) > f.first) f.first = WiFi.RSSI(i);
        dup = true;
        break;
      }
    }
    if (!dup) found.push_back({WiFi.RSSI(i), name});
  }
  WiFi.scanDelete();
  std::sort(found.begin(), found.end(), [](const auto &a, const auto &b) { return a.first > b.first; });
  for (size_t i = 0; i < found.size() && i < 20; i++) networks.push_back(found[i].second);
  Serial.printf("[setup] found %u Wi-Fi networks\n", static_cast<unsigned>(networks.size()));
}

void sendPage(const String &body) {
  String html =
      "<!doctype html><html><head><meta charset=utf-8>"
      "<meta name=viewport content='width=device-width,initial-scale=1'>"
      "<title>SmartRO Wi-Fi setup</title><style>"
      "body{font-family:sans-serif;margin:0;padding:20px;background:#f4f7f6;color:#123}"
      "h1{font-size:20px;color:#0E7C66}label{display:block;margin-top:14px;font-weight:bold}"
      "input,select{width:100%;box-sizing:border-box;padding:12px;margin-top:6px;font-size:16px;"
      "border:1px solid #bcd;border-radius:10px;background:#fff}"
      "button{width:100%;margin-top:20px;padding:14px;font-size:17px;border:0;border-radius:10px;"
      "background:#0E7C66;color:#fff}.err{background:#fde8e8;color:#9b1c1c;padding:10px;border-radius:10px}"
      ".note{color:#567;font-size:14px}</style></head><body>";
  html += body;
  html += "</body></html>";
  srv->sendHeader("Cache-Control", "no-store");
  srv->send(200, "text/html", html);
}

void handleRoot() {
  String b = "<h1>Connect your purifier to Wi-Fi</h1>";
  if (errorText.length()) b += "<p class=err>" + escapeHtml(errorText) + "</p>";
  b += "<form method=post action=/save><label for=pick>Wi-Fi network</label>"
       "<select id=pick onchange=\"if(this.value)document.getElementById('s').value=this.value\">"
       "<option value=''>Choose a network</option>";
  for (const String &n : networks) {
    const String e = escapeHtml(n);
    b += "<option value=\"" + e + "\">" + e + "</option>";
  }
  b += "</select><label for=s>Wi-Fi name</label>"
       "<input id=s name=ssid maxlength=32 required autocapitalize=none autocorrect=off value=\"" +
       escapeHtml(savedSsid) +
       "\"><label for=p>Password</label>"
       "<input id=p name=pass type=password maxlength=63 autocapitalize=none autocorrect=off>"
       "<button type=submit>Connect</button></form>"
       "<p class=note>Use the same Wi-Fi your phone uses at home. The purifier works with 2.4 GHz Wi-Fi only.</p>"
       "<p class=note><a href=/rescan>Scan again</a></p>";
  if (purifier::provisioned()) b += "<p class=note>Purifier " + escapeHtml(purifier::serial()) + "</p>";
  sendPage(b);
}

void handleSave() {
  String ssid = srv->arg("ssid");
  const String pass = srv->arg("pass");
  ssid.trim();  // phone keyboards add a trailing space after autocomplete
  if (ssid.isEmpty() || ssid.length() > 32) {
    errorText = "Type the Wi-Fi name.";
    handleRoot();
    return;
  }
  if (pass.length() != 0 && (pass.length() < 8 || pass.length() > 63)) {
    errorText = "Wi-Fi passwords are 8 to 63 characters. Leave it empty only for an open network.";
    savedSsid = ssid;
    handleRoot();
    return;
  }
  purifier::saveWifi(ssid, pass);
  Serial.printf("[setup] saved Wi-Fi \"%s\", restarting\n", ssid.c_str());
  sendPage("<h1>Saved</h1><p>The purifier is restarting and joining <b>" + escapeHtml(ssid) +
           "</b>.</p><p>When the blue light stops blinking, it is connected. You can close this page "
           "and open the SmartRO app.</p><p class=note>If the name or password was wrong, this setup "
           "network comes back in about a minute.</p>");
  restartAtMs = millis() + 2000;  // let the page reach the phone first
}

void handleRescan() {
  scan();
  srv->sendHeader("Location", "/");
  srv->send(302, "text/plain", "");
}

// Phones probe a known URL to detect a sign-in page; send every unknown URL to the form.
void handleAny() {
  srv->sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/");
  srv->send(302, "text/plain", "");
}

}  // namespace

void begin(WebServer &server, DNSServer &dns, const String &apName, bool canTimeOut) {
  srv = &server;
  dnsSrv = &dns;
  timeOut = canTimeOut;
  startMs = millis();

  const purifier::WifiSettings saved = purifier::loadWifi();
  savedSsid = saved.ssid;
  errorText = purifier::takeWifiError();

  WiFi.persistent(false);
  WiFi.mode(WIFI_AP_STA);
  WiFi.disconnect();
  scan();
  WiFi.softAP(apName.c_str());  // open network, only up while setting up
  delay(200);

  dns.setErrorReplyCode(DNSReplyCode::NoError);
  dns.start(53, "*", WiFi.softAPIP());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/rescan", HTTP_GET, handleRescan);
  server.onNotFound(handleAny);
  server.begin();

  Serial.printf("[setup] join the Wi-Fi \"%s\" from your phone, then open http://%s/\n", apName.c_str(),
                WiFi.softAPIP().toString().c_str());
}

void loop() {
  dnsSrv->processNextRequest();
  if (restartAtMs && static_cast<int32_t>(millis() - restartAtMs) >= 0) ESP.restart();
  if (timeOut && !restartAtMs && millis() - startMs > timing::SETUP_TIMEOUT_MS) {
    Serial.println("[setup] nobody finished setup in 10 minutes, going back to the saved Wi-Fi");
    ESP.restart();
  }
}

}  // namespace portal
