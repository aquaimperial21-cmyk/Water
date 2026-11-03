#include "util.h"

#include <esp_mac.h>
#include <esp_random.h>
#include <mbedtls/md.h>
#include <time.h>

static const char HEX_DIGITS[] = "0123456789abcdef";

static String toHex(const uint8_t *data, size_t len) {
  String out;
  out.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    out += HEX_DIGITS[data[i] >> 4];
    out += HEX_DIGITS[data[i] & 0x0f];
  }
  return out;
}

String hmacSha256Hex(const String &key, const String &msg) {
  uint8_t mac[32];
  const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  int rc = mbedtls_md_hmac(info, reinterpret_cast<const unsigned char *>(key.c_str()), key.length(),
                           reinterpret_cast<const unsigned char *>(msg.c_str()), msg.length(), mac);
  if (rc != 0) return String();
  return toHex(mac, sizeof(mac));
}

String randomHex(size_t bytes) {
  uint8_t buf[32];
  if (bytes > sizeof(buf)) bytes = sizeof(buf);
  esp_fill_random(buf, bytes);
  return toHex(buf, bytes);
}

bool sameSecret(const String &a, const String &b) {
  if (a.length() != b.length() || a.length() == 0) return false;
  uint8_t diff = 0;
  for (size_t i = 0; i < a.length(); i++) diff |= static_cast<uint8_t>(a[i] ^ b[i]);
  return diff == 0;
}

// Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's algorithm).
static int64_t daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2 ? 1 : 0;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = static_cast<unsigned>(y - era * 400);
  const unsigned mp = m > 2 ? m - 3 : m + 9;
  const unsigned doy = (153 * mp + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return static_cast<int64_t>(era) * 146097 + static_cast<int64_t>(doe) - 719468;
}

bool parseIsoUtc(const char *s, uint32_t &epochOut) {
  if (!s) return false;
  int y, mo, d, h, mi, sec;
  int used = 0;
  if (sscanf(s, "%4d-%2d-%2dT%2d:%2d:%2d%n", &y, &mo, &d, &h, &mi, &sec, &used) != 6) return false;
  if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 60) return false;
  const char *rest = s + used;
  if (*rest == '.') {
    rest++;
    while (*rest >= '0' && *rest <= '9') rest++;
  }
  if (rest[0] != 'Z' || rest[1] != '\0') return false;  // the server always sends UTC
  int64_t epoch = daysFromCivil(y, mo, d) * 86400 + h * 3600 + mi * 60 + sec;
  if (epoch <= 0 || epoch > 0xFFFFFFFFLL) return false;
  epochOut = static_cast<uint32_t>(epoch);
  return true;
}

String formatIsoUtc(uint32_t epoch) {
  time_t t = static_cast<time_t>(epoch);
  struct tm tm;
  gmtime_r(&t, &tm);
  char buf[24];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
  return String(buf);
}

String macSuffix() {
  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_WIFI_STA);  // works before Wi-Fi starts
  char buf[7];
  snprintf(buf, sizeof(buf), "%02x%02x%02x", mac[3], mac[4], mac[5]);
  return String(buf);
}
