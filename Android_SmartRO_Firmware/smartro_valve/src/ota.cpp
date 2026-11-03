#include "ota.h"

#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <Preferences.h>
#include <Update.h>
#include <WiFi.h>
#include <esp_mac.h>
#include <esp_ota_ops.h>
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <mbedtls/base64.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>

#include <memory>
#include <new>

#include "cloud.h"
#include "config.h"
#include "ota_pubkey.h"
#include "purifier.h"

#ifndef OTA_TEST_CRASH_ON_BOOT
#define OTA_TEST_CRASH_ON_BOOT 0
#endif

// Arduino confirms a new image before setup() unless this says "later". We
// confirm it ourselves once the server has answered (see finishTrial), so a
// new image boots in ESP_OTA_IMG_PENDING_VERIFY and the bootloader puts the
// old one back if it restarts before that.
extern "C" bool verifyRollbackLater() { return true; }

namespace ota {
namespace {

constexpr unsigned MAX_ATTEMPTS = 3;
constexpr uint8_t NEVER = 0xFF;  // fails_ value: never install this release again
constexpr uint32_t RETRY_MS = 30UL * 60UL * 1000UL;
constexpr uint32_t TRIAL_WIFI_MS = 10UL * 60UL * 1000UL;  // Wi-Fi time a trial image gets to reach the server
constexpr uint32_t TRIAL_CONFIRM_GRACE_MS = 60UL * 1000UL;
constexpr uint32_t OFFER_MAX_AGE_MS = 10UL * 60UL * 1000UL;  // older offers are checked with the server first
constexpr uint32_t REFRESH_EVERY_MS = 5UL * 60UL * 1000UL;
constexpr uint32_t MIN_FREE_HEAP = 45000;
constexpr uint32_t MIN_HEAP_BLOCK = 24000;  // TLS wants ~17 KB buffers in one piece
constexpr size_t CHUNK = 4096;
constexpr uint32_t STALL_MS = 20000;
constexpr uint32_t DOWNLOAD_MAX_MS = 15UL * 60UL * 1000UL;
constexpr uint32_t MAX_IMAGE = 4UL * 1024UL * 1024UL;  // sanity bound; the real limit is the slot size
constexpr uint32_t IST_OFFSET_SEC = 5UL * 3600UL + 30UL * 60UL;
constexpr uint32_t WINDOW_FROM_SEC = 2UL * 3600UL;  // 02:00 IST
constexpr uint32_t WINDOW_TO_SEC = 5UL * 3600UL;    // 05:00 IST
constexpr uint32_t SPREAD_MIN = 120;  // each purifier starts at its own minute in 02:00-03:59
constexpr uint8_t REPORT_TRIES = 4;
constexpr uint32_t REPORT_RETRY_MS = 2UL * 60UL * 1000UL;
constexpr const char *NS = "ota";  // NVS namespace
constexpr uint32_t GEN_UNKNOWN = 0xFFFFFFFFUL;  // relGen_ before an offer for relId_ was seen

struct Offer {
  bool present;
  bool installNow;
  char id[64];
  char version[32];
  uint32_t size;
  uint8_t sha[32];
  uint8_t sig[80];  // DER ECDSA P-256 signature, at most 72 bytes
  size_t sigLen;
  char bad[64];     // why this offer can't be installed, "" when it's fine
  uint32_t retryGen;  // goes up each time an admin presses Retry for this purifier
  uint32_t receivedMs;
};

// What the cloud task would do with the current offer, in order of precedence.
enum class Why : uint8_t {
  None,         // nothing offered
  SameVersion,  // the offer is what runs now
  GaveUp,       // failed MAX_ATTEMPTS times, or never again
  Trial,        // this boot is a new image on trial
  RetryWait,    // the last try failed less than 30 min ago
  BadOffer,     // the offer itself is unusable: reported as FAILED
  NeedClock,
  NightWindow,
  NoWifi,
  LowMemory,
  StaleOffer,   // ask the server again before installing
  Go,
};

enum class Activity : uint8_t { None, Downloading, Verifying, Restarting };

struct Report {
  bool active;
  uint32_t seq;
  char releaseId[64];
  char status[12];
  char error[201];  // the server takes at most 200 characters
  uint8_t tries;
  uint32_t nextMs;
};

// ── Shared state, guarded by lock_ ──────────────────────────────────────────
SemaphoreHandle_t lock_ = nullptr;
Offer offer_ = {};
char pendId_[64] = "";   // release installed, waiting for its first boot to be confirmed
char pendVer_[32] = "";  // the version that release claims
char relId_[64] = "";    // the release fails_ counts for
uint8_t fails_ = 0;
uint32_t relGen_ = GEN_UNKNOWN;  // the offer's retryGen that fails_ counts under
char lastErr_[100] = "";
bool retryWait_ = false;  // retryAtMs_ applies to relId_
uint32_t retryAtMs_ = 0;
bool force_ = false;      // console "ota now"
Activity act_ = Activity::None;
uint8_t pct_ = 0;
volatile bool trial_ = false;  // written under lock_, read without it on the fast paths
bool stateOk_ = false;
uint32_t wifiMs_ = 0;    // Wi-Fi time since boot, counted only during a trial
uint32_t lastAccMs_ = 0;
Report outbox_ = {};     // the last report that didn't go through yet
uint32_t outboxSeq_ = 0;

// Set in begin(), read-only afterwards.
uint32_t windowFrom_ = WINDOW_FROM_SEC;

// Cloud task only.
Why lastWhy_ = Why::None;
char lastWhyId_[64] = "";
bool askedRefresh_ = false;
uint32_t lastRefreshAskMs_ = 0;
bool warnedBadId_ = false;

struct Guard {
  Guard() { xSemaphoreTake(lock_, portMAX_DELAY); }
  ~Guard() { xSemaphoreGive(lock_); }
};

struct View {
  Offer offer;
  bool trial;
  bool stateOk;
  uint32_t wifiMs;
  char relId[64];
  uint8_t fails;
  uint32_t relGen;
  bool retryWait;
  uint32_t retryAtMs;
  bool force;
  Activity act;
  uint8_t pct;
  char lastErr[100];
};

View view() {
  View v;
  Guard g;
  v.offer = offer_;
  v.trial = trial_;
  v.stateOk = stateOk_;
  v.wifiMs = wifiMs_;
  memcpy(v.relId, relId_, sizeof(v.relId));
  v.fails = fails_;
  v.relGen = relGen_;
  v.retryWait = retryWait_;
  v.retryAtMs = retryAtMs_;
  v.force = force_;
  v.act = act_;
  v.pct = pct_;
  memcpy(v.lastErr, lastErr_, sizeof(v.lastErr));
  return v;
}

// ── NVS ─────────────────────────────────────────────────────────────────────
// Keys (namespace "ota"): pendId, pendVer, relId, fails, relGen, lastErr, rbWhy.

void readStr(Preferences &p, const char *key, char *out, size_t len) {
  out[0] = '\0';
  if (p.isKey(key)) p.getString(key, out, len);
}

void writeStr(Preferences &p, const char *key, const char *value) {
  if (value[0]) {
    p.putString(key, value);
  } else if (p.isKey(key)) {
    p.remove(key);
  }
}

void savePending(const char *id, const char *version) {
  Preferences p;
  p.begin(NS, false);
  writeStr(p, "pendId", id);
  writeStr(p, "pendVer", version);
  p.end();
}

void saveRollbackReason(const char *why) {
  Preferences p;
  p.begin(NS, false);
  writeStr(p, "rbWhy", why);
  p.end();
}

void clearLastError() {
  {
    Guard g;
    lastErr_[0] = '\0';
  }
  Preferences p;
  p.begin(NS, false);
  writeStr(p, "lastErr", "");
  p.end();
}

// One more failed attempt for release id (or never again), and wait 30 min before the next.
void recordFailure(const char *id, const char *error, bool never) {
  char rel[64];
  char err[100];
  uint8_t fails;
  uint32_t gen;
  {
    Guard g;
    if (strcmp(relId_, id) != 0) {
      strlcpy(relId_, id, sizeof(relId_));
      fails_ = 0;
      relGen_ = GEN_UNKNOWN;  // the next offer of it supplies its retryGen
    }
    if (never) {
      fails_ = NEVER;
    } else if (fails_ < MAX_ATTEMPTS) {
      fails_++;
    }
    strlcpy(lastErr_, error, sizeof(lastErr_));
    retryWait_ = true;
    retryAtMs_ = millis() + RETRY_MS;
    memcpy(rel, relId_, sizeof(rel));
    memcpy(err, lastErr_, sizeof(err));
    fails = fails_;
    gen = relGen_;
  }
  Preferences p;
  p.begin(NS, false);
  p.putString("relId", rel);
  p.putUChar("fails", fails);
  p.putUInt("relGen", gen);
  writeStr(p, "lastErr", err);
  p.end();
}

// Cloud task, for each offer. A new release starts with no tries. The same
// release with a new retryGen means an admin pressed Retry: its tries start
// again, even after "never again".
void trackRelease(const char *id, const char *version, uint32_t gen) {
  bool retry = false;
  char rel[64];
  uint8_t fails;
  {
    Guard g;
    if (strcmp(relId_, id) != 0) {
      strlcpy(relId_, id, sizeof(relId_));
      fails_ = 0;
      retryWait_ = false;  // that wait was for the other release
    } else if (relGen_ == gen) {
      return;  // the usual case: nothing changed, nothing written
    } else if (relGen_ != GEN_UNKNOWN) {
      retry = true;
      fails_ = 0;
      retryWait_ = false;
      lastErr_[0] = '\0';
    }
    relGen_ = gen;
    memcpy(rel, relId_, sizeof(rel));
    fails = fails_;
  }
  if (retry) Serial.printf("[ota] admin pressed Retry for %s: tries start again\n", version);
  Preferences p;
  p.begin(NS, false);
  p.putString("relId", rel);
  p.putUChar("fails", fails);
  p.putUInt("relGen", gen);
  if (retry) writeStr(p, "lastErr", "");
  p.end();
}

// ── Small helpers ───────────────────────────────────────────────────────────

uint32_t istSecOfDay(uint32_t utc) { return (utc + IST_OFFSET_SEC) % 86400UL; }

bool inWindow(uint32_t utc) {
  const uint32_t s = istSecOfDay(utc);
  return s >= windowFrom_ && s < WINDOW_TO_SEC;
}

unsigned hh(uint32_t secOfDay) { return static_cast<unsigned>(secOfDay / 3600); }
unsigned mm(uint32_t secOfDay) { return static_cast<unsigned>((secOfDay / 60) % 60); }

bool validId(const char *s) {
  const size_t n = strlen(s);
  if (n < 1 || n > 63) return false;  // it goes into the download URL
  for (size_t i = 0; i < n; i++) {
    const char c = s[i];
    if (!isalnum(static_cast<unsigned char>(c)) && c != '-' && c != '_') return false;
  }
  return true;
}

bool validVersion(const char *s) {
  const size_t n = strlen(s);
  if (n < 1 || n > 31) return false;
  for (size_t i = 0; i < n; i++) {
    if (s[i] < 0x21 || s[i] > 0x7e) return false;
  }
  return true;
}

int hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

bool parseSha(const char *s, uint8_t out[32]) {
  if (strlen(s) != 64) return false;
  for (size_t i = 0; i < 32; i++) {
    const int hi = hexNibble(s[2 * i]);
    const int lo = hexNibble(s[2 * i + 1]);
    if (hi < 0 || lo < 0) return false;
    out[i] = static_cast<uint8_t>((hi << 4) | lo);
  }
  return true;
}

const char *resetName(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_PANIC: return "crash";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT: return "watchdog";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_POWERON: return "power cut";
    case ESP_RST_SW: return "restart";
    case ESP_RST_EXT: return "reset button";
    default: return "reset";
  }
}

const char *imageStateName(esp_ota_img_states_t s) {
  switch (s) {
    case ESP_OTA_IMG_NEW: return "new";
    case ESP_OTA_IMG_PENDING_VERIFY: return "on trial";
    case ESP_OTA_IMG_VALID: return "confirmed";
    case ESP_OTA_IMG_INVALID: return "invalid";
    case ESP_OTA_IMG_ABORTED: return "aborted";
    default: return "normal";  // no OTA state: flashed by USB, or kept from before
  }
}

void setActivity(Activity a, uint8_t pct) {
  Guard g;
  act_ = a;
  pct_ = pct;
}

// 0 when sig is a valid signature of hash under OTA_PUBKEY_PEM, else an mbedtls error.
int verifySignature(const uint8_t hash[32], const uint8_t *sig, size_t sigLen) {
  mbedtls_pk_context pk;
  mbedtls_pk_init(&pk);
  int rc = mbedtls_pk_parse_public_key(&pk, reinterpret_cast<const unsigned char *>(OTA_PUBKEY_PEM),
                                       strlen(OTA_PUBKEY_PEM) + 1);
  if (rc == 0 && !mbedtls_pk_can_do(&pk, MBEDTLS_PK_ECDSA)) rc = MBEDTLS_ERR_PK_TYPE_MISMATCH;
  if (rc == 0) rc = mbedtls_pk_verify(&pk, MBEDTLS_MD_SHA256, hash, 32, sig, sigLen);
  mbedtls_pk_free(&pk);
  return rc;
}

// ── Reports to the server (best effort) ─────────────────────────────────────

bool delivered(int code) { return code >= 200 && code < 300; }
bool worthRetry(int code) { return code < 0 || code == 408 || code == 429 || code >= 500; }

// Cloud task only.
int sendReport(const char *id, const char *status, const char *error) {
  JsonDocument doc;
  doc["releaseId"] = id;
  doc["status"] = status;
  if (error[0]) doc["error"] = error;
  doc["version"] = FW_VERSION;  // what runs now
  String body;
  serializeJson(doc, body);
  const int code = cloud::postJson("/devices/" + purifier::serial() + "/ota-report", body);
  if (delivered(code)) {
    Serial.printf("[ota] told the server: %s\n", status);
  } else {
    Serial.printf("[ota] couldn't tell the server %s (%d)\n", status, code);
  }
  return code;
}

// Any task. The cloud task sends it at its next pass.
void queueReport(const char *id, const char *status, const char *error) {
  Guard g;
  outbox_.active = true;
  outbox_.seq = ++outboxSeq_;
  strlcpy(outbox_.releaseId, id, sizeof(outbox_.releaseId));
  strlcpy(outbox_.status, status, sizeof(outbox_.status));
  strlcpy(outbox_.error, error, sizeof(outbox_.error));
  outbox_.tries = 0;
  outbox_.nextMs = millis();
}

// Cloud task only. A newer report replaces one that hasn't gone through yet.
void reportNow(const char *id, const char *status, const char *error, bool keepIfUndelivered) {
  {
    Guard g;
    outbox_.active = false;
  }
  const int code = sendReport(id, status, error);
  if (delivered(code) || !keepIfUndelivered || !worthRetry(code)) return;
  queueReport(id, status, error);
  Guard g;
  outbox_.tries = 1;
  outbox_.nextMs = millis() + REPORT_RETRY_MS;
}

// Cloud task only.
void flushOutbox() {
  Report r;
  {
    Guard g;
    if (!outbox_.active || static_cast<int32_t>(millis() - outbox_.nextMs) < 0) return;
    r = outbox_;
  }
  const int code = sendReport(r.releaseId, r.status, r.error);
  Guard g;
  if (!outbox_.active || outbox_.seq != r.seq) return;  // replaced meanwhile
  outbox_.tries++;
  if (delivered(code) || !worthRetry(code) || outbox_.tries >= REPORT_TRIES) {
    outbox_.active = false;
  } else {
    outbox_.nextMs = millis() + REPORT_RETRY_MS;
  }
}

// ── Trial of a new image ────────────────────────────────────────────────────

// Keeps the running image and tells the server how it went. trial_ is already false.
void finishTrial() {
  const esp_err_t e = esp_ota_mark_app_valid_cancel_rollback();
  if (e != ESP_OK) Serial.printf("[ota] couldn't mark this firmware as good (%s)\n", esp_err_to_name(e));

  char id[64];
  char ver[32];
  {
    Guard g;
    memcpy(id, pendId_, sizeof(id));
    memcpy(ver, pendVer_, sizeof(ver));
    pendId_[0] = '\0';
    pendVer_[0] = '\0';
  }
  if (!id[0]) {
    Serial.println("[ota] firmware " FW_VERSION " confirmed: the server answered");
    return;
  }
  if (strcmp(ver, FW_VERSION) == 0) {
    Serial.println("[ota] firmware " FW_VERSION " confirmed: the server answered. Keeping it.");
    clearLastError();
    queueReport(id, "INSTALLED", "");
  } else {
    // A mislabeled binary: the server would offer it again and again. It runs
    // fine (it reached the server), so keep it, but never install this release again.
    char msg[64];
    snprintf(msg, sizeof(msg), "installed image reports %s", FW_VERSION);
    Serial.printf("[ota] release %s says %s but the new firmware reports %s. Keeping it; "
                  "this release won't be installed again.\n", id, ver, FW_VERSION);
    recordFailure(id, msg, true);
    queueReport(id, "FAILED", msg);
  }
  savePending("", "");
}

// trial_ is already false. Restarts into the previous image if there is one.
void rollBack(const char *why) {
  Serial.printf("[ota] %s: going back to the previous firmware\n", why);
  saveRollbackReason(why);
  Serial.flush();
  const esp_err_t e = esp_ota_mark_app_invalid_rollback_and_reboot();  // returns only on failure
  Serial.printf("[ota] can't go back (%s), keeping this firmware\n", esp_err_to_name(e));
  saveRollbackReason("");
  finishTrial();
}

// Both tasks call these: a hung cloud task or a hung loop still ends a bad trial.
void countWifiTime() {
  if (!trial_) return;
  const bool up = WiFi.status() == WL_CONNECTED;
  Guard g;
  const uint32_t nowMs = millis();
  if (up) wifiMs_ += nowMs - lastAccMs_;
  lastAccMs_ = nowMs;
}

void checkTrialTimeout() {
  if (!trial_) return;
  bool answered;
  {
    Guard g;
    // The loop confirms within a second of a server answer; the grace is only for that hand-over.
    const uint32_t limit = TRIAL_WIFI_MS + (stateOk_ ? TRIAL_CONFIRM_GRACE_MS : 0);
    if (!trial_ || wifiMs_ < limit) return;
    trial_ = false;
    answered = stateOk_;
  }
  rollBack(answered ? "the new firmware reached the server but never confirmed itself"
                    : "no server answer in 10 min of Wi-Fi");
}

// ── Offer decisions ─────────────────────────────────────────────────────────

uint8_t triesFor(const View &v) { return strcmp(v.relId, v.offer.id) == 0 ? v.fails : 0; }

Why decide(const View &v) {
  if (!v.offer.present) return Why::None;
  if (strcmp(v.offer.version, FW_VERSION) == 0) return Why::SameVersion;
  if (triesFor(v) >= MAX_ATTEMPTS) return Why::GaveUp;
  if (v.trial) return Why::Trial;
  if (!v.force && v.retryWait && strcmp(v.relId, v.offer.id) == 0 &&
      static_cast<int32_t>(v.retryAtMs - millis()) > 0) {
    return Why::RetryWait;
  }
  if (v.offer.bad[0]) return Why::BadOffer;
  if (!v.offer.installNow && !v.force) {
    const uint32_t t = purifier::now();
    if (t == 0) return Why::NeedClock;
    if (!inWindow(t)) return Why::NightWindow;
  }
  if (WiFi.status() != WL_CONNECTED) return Why::NoWifi;
  if (ESP.getFreeHeap() < MIN_FREE_HEAP || ESP.getMaxAllocHeap() < MIN_HEAP_BLOCK) return Why::LowMemory;
  if (millis() - v.offer.receivedMs > OFFER_MAX_AGE_MS) return Why::StaleOffer;
  return Why::Go;
}

uint32_t minutesLeft(uint32_t atMs) {
  const int32_t left = static_cast<int32_t>(atMs - millis());
  return left > 0 ? (static_cast<uint32_t>(left) + 59999UL) / 60000UL : 0;
}

String describe(const View &v, Why w) {
  char b[200];
  switch (v.act) {
    case Activity::Downloading:
      snprintf(b, sizeof(b), "downloading %s: %u%%", v.offer.version, static_cast<unsigned>(v.pct));
      return b;
    case Activity::Verifying:
      snprintf(b, sizeof(b), "checking %s (sha256 and signature)", v.offer.version);
      return b;
    case Activity::Restarting:
      snprintf(b, sizeof(b), "installed %s, restarting into it", v.offer.version);
      return b;
    case Activity::None: break;
  }
  if (v.trial) w = Why::Trial;  // with or without an offer
  switch (w) {
    case Why::None:
    case Why::SameVersion: return "idle";
    case Why::Trial: return "pending verify: " FW_VERSION " runs on trial until the server answers";
    case Why::GaveUp:
      if (v.fails == NEVER) {
        snprintf(b, sizeof(b), "failed: %s (%s won't be installed again)", v.lastErr, v.offer.version);
      } else {
        snprintf(b, sizeof(b), "failed: %s (gave up on %s after %u tries)", v.lastErr, v.offer.version, MAX_ATTEMPTS);
      }
      return b;
    case Why::RetryWait:
      snprintf(b, sizeof(b), "failed: %s (try %u of %u, next in %lu min)", v.lastErr, static_cast<unsigned>(triesFor(v)), MAX_ATTEMPTS,
               static_cast<unsigned long>(minutesLeft(v.retryAtMs)));
      return b;
    case Why::BadOffer: snprintf(b, sizeof(b), "failed: %s", v.offer.bad); return b;
    case Why::NeedClock:
      snprintf(b, sizeof(b), "%s offered, waiting for the clock (installs %02u:%02u-05:00 IST)", v.offer.version,
               hh(windowFrom_), mm(windowFrom_));
      return b;
    case Why::NightWindow:
      snprintf(b, sizeof(b), "%s offered, waiting for the night window (%02u:%02u-05:00 IST)", v.offer.version,
               hh(windowFrom_), mm(windowFrom_));
      return b;
    case Why::NoWifi: snprintf(b, sizeof(b), "%s offered, waiting for Wi-Fi", v.offer.version); return b;
    case Why::LowMemory: snprintf(b, sizeof(b), "%s offered, waiting for free memory", v.offer.version); return b;
    case Why::StaleOffer:
      snprintf(b, sizeof(b), "%s offered, checking with the server before installing", v.offer.version);
      return b;
    case Why::Go: snprintf(b, sizeof(b), "%s offered, starting", v.offer.version); return b;
  }
  return "idle";
}

const char *stateName(const View &v, Why w) {
  switch (v.act) {
    case Activity::Downloading: return "downloading";
    case Activity::Verifying: return "verifying";
    case Activity::Restarting: return "restarting";
    case Activity::None: break;
  }
  if (v.trial) return "pending_verify";
  switch (w) {
    case Why::None:
    case Why::SameVersion: return "idle";
    case Why::GaveUp:
    case Why::RetryWait:
    case Why::BadOffer: return "failed";
    default: return "waiting";
  }
}

// Cloud task: logs when the decision about an offer changes (not every pass).
void noteDecision(const View &v, Why w) {
  if (w == lastWhy_ && strcmp(lastWhyId_, v.offer.id) == 0) return;
  lastWhy_ = w;
  strlcpy(lastWhyId_, v.offer.id, sizeof(lastWhyId_));
  switch (w) {
    case Why::GaveUp:
    case Why::RetryWait:
    case Why::NeedClock:
    case Why::NightWindow:
    case Why::LowMemory:
      Serial.printf("[ota] %s\n", describe(v, w).c_str());
      break;
    default: break;
  }
}

// ── Install ─────────────────────────────────────────────────────────────────

struct Sha256 {
  mbedtls_sha256_context ctx;
  Sha256() { mbedtls_sha256_init(&ctx); }
  ~Sha256() { mbedtls_sha256_free(&ctx); }  // also releases the SHA hardware
};

struct UpdateGuard {
  ~UpdateGuard() {
    if (Update.isRunning()) Update.abort();  // a half-written slot is never bootable
  }
};

struct HttpGuard {
  HTTPClient &http;
  ~HttpGuard() { http.end(); }
};

// Downloads o into the free slot, checks SHA-256 and signature, and makes it
// the boot image. False with err set on any failure (the slot stays unused).
bool download(const Offer &o, char *err, size_t errLen) {
  const esp_partition_t *slot = esp_ota_get_next_update_partition(nullptr);
  if (!slot) {
    snprintf(err, errLen, "no update slot");
    return false;
  }
  if (o.size == 0 || o.size > slot->size) {
    snprintf(err, errLen, "size %lu doesn't fit the %lu-byte slot", static_cast<unsigned long>(o.size),
             static_cast<unsigned long>(slot->size));
    return false;
  }
  std::unique_ptr<uint8_t[]> buf(new (std::nothrow) uint8_t[CHUNK]);
  if (!buf) {
    snprintf(err, errLen, "out of memory");
    return false;
  }

  NetworkClientSecure secure;
  NetworkClient plain;
  HTTPClient http;
  if (!cloud::beginRequest(http, secure, plain, "/devices/" + purifier::serial() + "/firmware/" + o.id, 15000)) {
    snprintf(err, errLen, "download: bad server address");
    return false;
  }
  HttpGuard httpGuard{http};
  http.addHeader("Accept", "application/octet-stream");
  const int code = http.GET();
  if (code != 200) {
    if (code < 0) {
      snprintf(err, errLen, "download: no answer (%s)", HTTPClient::errorToString(code).c_str());
    } else {
      snprintf(err, errLen, "download: HTTP %d", code);
    }
    return false;
  }
  const int len = http.getSize();  // -1 without Content-Length
  if (len < 0 || static_cast<uint32_t>(len) != o.size) {
    snprintf(err, errLen, "size: server sends %d bytes, the offer says %lu", len, static_cast<unsigned long>(o.size));
    return false;
  }
  NetworkClient *stream = http.getStreamPtr();
  if (!stream) {
    snprintf(err, errLen, "download: connection lost");
    return false;
  }

  if (!Update.begin(o.size, U_FLASH)) {
    snprintf(err, errLen, "flash: %s", Update.errorString());
    return false;
  }
  UpdateGuard updateGuard;
  Sha256 sha;
  if (mbedtls_sha256_starts(&sha.ctx, 0) != 0) {
    snprintf(err, errLen, "sha256 start failed");
    return false;
  }

  uint32_t got = 0;
  uint8_t shownPct = 0;
  const uint32_t startMs = millis();
  uint32_t lastDataMs = startMs;
  while (got < o.size) {
    if (millis() - startMs > DOWNLOAD_MAX_MS) {
      snprintf(err, errLen, "download: too slow (%lu of %lu bytes in 15 min)", static_cast<unsigned long>(got),
               static_cast<unsigned long>(o.size));
      return false;
    }
    const int avail = stream->available();
    if (avail <= 0) {
      if (!stream->connected()) {
        snprintf(err, errLen, "download: connection closed at %lu of %lu bytes", static_cast<unsigned long>(got),
                 static_cast<unsigned long>(o.size));
        return false;
      }
      if (millis() - lastDataMs > STALL_MS) {
        snprintf(err, errLen, "download: stalled at %lu of %lu bytes", static_cast<unsigned long>(got),
                 static_cast<unsigned long>(o.size));
        return false;
      }
      vTaskDelay(pdMS_TO_TICKS(5));
      continue;
    }
    size_t want = static_cast<size_t>(avail);
    if (want > CHUNK) want = CHUNK;
    if (want > o.size - got) want = o.size - got;
    const int n = stream->read(buf.get(), want);
    if (n <= 0) {
      vTaskDelay(pdMS_TO_TICKS(5));
      continue;
    }
    const size_t nn = static_cast<size_t>(n) > want ? want : static_cast<size_t>(n);
    if (mbedtls_sha256_update(&sha.ctx, buf.get(), nn) != 0) {
      snprintf(err, errLen, "sha256 update failed");
      return false;
    }
    if (Update.write(buf.get(), nn) != nn) {
      snprintf(err, errLen, "flash write at %lu: %s", static_cast<unsigned long>(got), Update.errorString());
      return false;
    }
    got += nn;
    lastDataMs = millis();
    const uint8_t pct = static_cast<uint8_t>(static_cast<uint64_t>(got) * 100U / o.size);
    if (pct != shownPct) {
      setActivity(Activity::Downloading, pct);
      if (pct / 10 != shownPct / 10) Serial.printf("[ota] downloading %s: %u%%\n", o.version, static_cast<unsigned>(pct));
      shownPct = pct;
    }
    vTaskDelay(1);  // let the idle task (task watchdog) and the Wi-Fi stack run
  }
  http.end();  // frees the TLS buffers before the checks

  setActivity(Activity::Verifying, 100);
  uint8_t hash[32];
  if (mbedtls_sha256_finish(&sha.ctx, hash) != 0) {
    snprintf(err, errLen, "sha256 finish failed");
    return false;
  }
  if (memcmp(hash, o.sha, sizeof(hash)) != 0) {
    snprintf(err, errLen, "sha256 mismatch (got %02x%02x%02x%02x...)", hash[0], hash[1], hash[2], hash[3]);
    return false;
  }
  const int rc = verifySignature(hash, o.sig, o.sigLen);
  if (rc != 0) {
    snprintf(err, errLen, "signature check failed (-0x%04x)", static_cast<unsigned>(-rc));
    return false;
  }
  if (!Update.end(true)) {
    snprintf(err, errLen, "activate: %s", Update.errorString());
    return false;
  }
  return true;
}

void failAttempt(const Offer &o, const char *why) {
  Serial.printf("[ota] update %s failed: %s. Next try in 30 min at the earliest.\n", o.version, why);
  setActivity(Activity::None, 0);
  recordFailure(o.id, why, false);
  reportNow(o.id, "FAILED", why, true);
}

void install(const Offer &o) {
  Serial.printf("[ota] installing firmware %s (%lu bytes). The water keeps working meanwhile.\n", o.version,
                static_cast<unsigned long>(o.size));
  setActivity(Activity::Downloading, 0);
  reportNow(o.id, "DOWNLOADING", "", false);

  char err[100] = "";
  if (!download(o, err, sizeof(err))) {
    failAttempt(o, err);
    return;
  }
  savePending(o.id, o.version);  // the next boot reads it to confirm or count a rollback
  setActivity(Activity::Restarting, 100);
  Serial.printf("[ota] firmware %s checked and installed. Restarting into it; it runs on trial until the "
                "server answers.\n", o.version);
  Serial.flush();
  vTaskDelay(pdMS_TO_TICKS(500));
  ESP.restart();
}

void askRefresh() {
  if (askedRefresh_ && millis() - lastRefreshAskMs_ < REFRESH_EVERY_MS) return;
  askedRefresh_ = true;
  lastRefreshAskMs_ = millis();
  Serial.println("[ota] asking the server again before installing");
  cloud::pollSoon();
}

}  // namespace

// ── Public ──────────────────────────────────────────────────────────────────

void begin() {
  lock_ = xSemaphoreCreateMutex();
  lastAccMs_ = millis();

  uint8_t mac[6] = {0};
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  windowFrom_ = WINDOW_FROM_SEC + ((static_cast<uint32_t>(mac[4]) << 8 | mac[5]) % SPREAD_MIN) * 60UL;

  char rbWhy[64];
  {
    Preferences p;
    p.begin(NS, false);
    readStr(p, "pendId", pendId_, sizeof(pendId_));
    readStr(p, "pendVer", pendVer_, sizeof(pendVer_));
    readStr(p, "relId", relId_, sizeof(relId_));
    fails_ = p.isKey("fails") ? p.getUChar("fails", 0) : 0;
    relGen_ = p.isKey("relGen") ? p.getUInt("relGen", GEN_UNKNOWN) : GEN_UNKNOWN;
    readStr(p, "lastErr", lastErr_, sizeof(lastErr_));
    readStr(p, "rbWhy", rbWhy, sizeof(rbWhy));
    p.end();
  }

  const esp_partition_t *running = esp_ota_get_running_partition();
  esp_ota_img_states_t st;
  trial_ = running && esp_ota_get_state_partition(running, &st) == ESP_OK && st == ESP_OTA_IMG_PENDING_VERIFY;

  if (trial_) {
    Serial.printf("[ota] new firmware " FW_VERSION " on trial (release %s). It stays once the server answers; "
                  "a restart or 10 min of Wi-Fi without an answer puts the old one back.\n",
                  pendId_[0] ? pendId_ : "unknown");
#if OTA_TEST_CRASH_ON_BOOT
    Serial.println("[ota] TEST BUILD: crashes on purpose 8 s after an over-the-air install");
#endif
  } else if (pendId_[0]) {
    if (strcmp(pendVer_, FW_VERSION) == 0) {
      // Confirmed on an earlier boot; the power went before the note was cleared.
      clearLastError();
      queueReport(pendId_, "INSTALLED", "");
    } else {
      char why[96];
      if (rbWhy[0]) {
        strlcpy(why, rbWhy, sizeof(why));
      } else {
        snprintf(why, sizeof(why), "it restarted before its first server check (%s)", resetName(esp_reset_reason()));
      }
      char msg[120];
      snprintf(msg, sizeof(msg), "back on %s: %s", FW_VERSION, why);
      Serial.printf("[ota] firmware %s was rolled back: %s\n", pendVer_, why);
      recordFailure(pendId_, msg, false);  // also waits 30 min before trying again
      queueReport(pendId_, "ROLLED_BACK", msg);
    }
    savePending("", "");
    pendId_[0] = '\0';
    pendVer_[0] = '\0';
  }
  if (rbWhy[0]) saveRollbackReason("");

  // A broken key would only show at the first update otherwise.
  mbedtls_pk_context pk;
  mbedtls_pk_init(&pk);
  if (mbedtls_pk_parse_public_key(&pk, reinterpret_cast<const unsigned char *>(OTA_PUBKEY_PEM),
                                  strlen(OTA_PUBKEY_PEM) + 1) != 0 ||
      !mbedtls_pk_can_do(&pk, MBEDTLS_PK_ECDSA)) {
    Serial.println("[ota] the update signing key in ota_pubkey.h is unreadable: no update will install");
  }
  mbedtls_pk_free(&pk);
}

void loop() {
  if (!trial_) return;
  static uint32_t lastMs = 0;
  const uint32_t nowMs = millis();
  if (nowMs - lastMs < 500) return;
  lastMs = nowMs;
  countWifiTime();

#if OTA_TEST_CRASH_ON_BOOT
  if (nowMs > 8000) {
    Serial.println("[ota] TEST BUILD: crashing on purpose to test the rollback");
    Serial.flush();
    abort();
  }
#else
  bool confirm;
  {
    Guard g;
    confirm = trial_ && stateOk_;
    if (confirm) trial_ = false;
  }
  if (confirm) {
    finishTrial();
    return;
  }
  checkTrialTimeout();
#endif
}

void handleOffer(JsonObjectConst fw) {
  if (fw.isNull()) {
    bool had;
    {
      Guard g;
      had = offer_.present;
      offer_.present = false;
    }
    if (had) Serial.println("[ota] the server no longer offers an update");
    return;
  }

  Offer o = {};
  const char *id = fw["id"] | "";
  if (!validId(id)) {  // can't even report on it
    {
      Guard g;
      offer_.present = false;
    }
    if (!warnedBadId_) Serial.println("[ota] the server's update offer has no usable id, ignoring it");
    warnedBadId_ = true;
    return;
  }
  warnedBadId_ = false;
  o.present = true;
  strlcpy(o.id, id, sizeof(o.id));
  o.installNow = fw["installNow"] | false;
  o.retryGen = fw["retryGen"].is<uint32_t>() ? fw["retryGen"].as<uint32_t>() : 0;  // missing: 0
  if (o.retryGen == GEN_UNKNOWN) o.retryGen = GEN_UNKNOWN - 1;
  o.receivedMs = millis();

  const char *version = fw["version"] | "";
  if (validVersion(version)) {
    strlcpy(o.version, version, sizeof(o.version));
  } else {
    strlcpy(o.version, "?", sizeof(o.version));
    strlcpy(o.bad, "offer: no usable version", sizeof(o.bad));
  }

  const esp_partition_t *slot = esp_ota_get_next_update_partition(nullptr);
  if (fw["size"].is<uint32_t>()) o.size = fw["size"].as<uint32_t>();
  if (o.bad[0]) {
    // keep the first problem
  } else if (o.size == 0 || o.size > MAX_IMAGE) {
    strlcpy(o.bad, "offer: no usable size", sizeof(o.bad));
  } else if (!slot) {
    strlcpy(o.bad, "no update slot", sizeof(o.bad));
  } else if (o.size > slot->size) {
    snprintf(o.bad, sizeof(o.bad), "size %lu doesn't fit the %lu-byte slot", static_cast<unsigned long>(o.size),
             static_cast<unsigned long>(slot->size));
  }

  if (!parseSha(fw["sha256"] | "", o.sha) && !o.bad[0]) strlcpy(o.bad, "offer: no usable sha256", sizeof(o.bad));

  const char *sig = fw["signature"] | "";
  const size_t sigChars = strlen(sig);
  // base64 of a DER P-256 signature is at most 96 characters
  if (sigChars == 0 || sigChars > 128 ||
      mbedtls_base64_decode(o.sig, sizeof(o.sig), &o.sigLen, reinterpret_cast<const unsigned char *>(sig), sigChars) !=
          0 ||
      o.sigLen < 8) {
    o.sigLen = 0;
    if (!o.bad[0]) strlcpy(o.bad, "offer: signature is not base64 DER", sizeof(o.bad));
  }

  trackRelease(o.id, o.version, o.retryGen);

  bool isNew;
  {
    Guard g;
    isNew = !offer_.present || strcmp(offer_.id, o.id) != 0 || strcmp(offer_.version, o.version) != 0 ||
            offer_.installNow != o.installNow;
    offer_ = o;
  }
  if (isNew) {
    Serial.printf("[ota] server offers firmware %s (%lu bytes, %s)%s%s\n", o.version,
                  static_cast<unsigned long>(o.size), o.installNow ? "install now" : "install at night",
                  o.bad[0] ? ": " : "", o.bad);
  }
}

void onStateOk() {
  if (!trial_) return;
  Guard g;
  stateOk_ = true;
}

void service() {
  countWifiTime();
  checkTrialTimeout();  // may restart
  flushOutbox();
  {
    Guard g;  // an expired wait must not come back when millis() wraps (49 days)
    if (retryWait_ && static_cast<int32_t>(retryAtMs_ - millis()) <= 0) retryWait_ = false;
  }

  const View v = view();
  const Why w = decide(v);
  noteDecision(v, w);
  switch (w) {
    case Why::StaleOffer:
      askRefresh();
      return;
    case Why::BadOffer:
      failAttempt(v.offer, v.offer.bad);
      return;
    case Why::Go:
      break;
    default:
      return;
  }
  {
    Guard g;
    force_ = false;
  }
  install(v.offer);  // returns only on failure
}

String requestNow() {
  if (!purifier::provisioned()) return "This purifier has no serial/token yet, so it can't get updates.";
  {
    Guard g;
    force_ = true;
  }
  cloud::pollSoon();
  const View v = view();
  const Why w = decide(v);
  char b[200];
  switch (w) {
    case Why::None:
      return "Nothing offered right now. Asked the server again; an update it offers installs right away.";
    case Why::SameVersion:
      snprintf(b, sizeof(b), "The server offers %s, which is already running.", v.offer.version);
      break;
    case Why::GaveUp:
      snprintf(b, sizeof(b), "Not installing %s: %s. Retry on the admin Firmware updates page starts it again.",
               v.offer.version,
               v.fails == NEVER ? "its image reported the wrong version" : "it already failed 3 times");
      break;
    case Why::Trial: return "This firmware is still on trial. Try again once the server has answered.";
    case Why::NoWifi: snprintf(b, sizeof(b), "Installs %s as soon as Wi-Fi is back.", v.offer.version); break;
    case Why::LowMemory:
      snprintf(b, sizeof(b), "Installs %s once there is enough free memory.", v.offer.version);
      break;
    default:
      snprintf(b, sizeof(b), "Installing %s now, skipping the night window. The water keeps working meanwhile.",
               v.offer.version);
      break;
  }
  if (w == Why::SameVersion || w == Why::GaveUp) {
    Guard g;
    force_ = false;
  }
  return b;
}

String statusLine() {
  const View v = view();
  return describe(v, decide(v));
}

void printDetail() {
  const View v = view();
  const Why w = decide(v);
  const esp_partition_t *running = esp_ota_get_running_partition();
  const esp_partition_t *next = esp_ota_get_next_update_partition(nullptr);
  esp_ota_img_states_t st = ESP_OTA_IMG_UNDEFINED;
  if (running) esp_ota_get_state_partition(running, &st);

  Serial.println("\n----- Remote updates (OTA) -----");
  Serial.printf("Running       %s from %s (%s)\n", FW_VERSION, running ? running->label : "?", imageStateName(st));
  if (next) Serial.printf("Update slot   %s, %lu bytes\n", next->label, static_cast<unsigned long>(next->size));
  Serial.printf("Status        %s\n", describe(v, w).c_str());
  if (v.offer.present) {
    Serial.printf("Offered       %s, %lu bytes, %s, release %s (heard %lu s ago)\n", v.offer.version,
                  static_cast<unsigned long>(v.offer.size), v.offer.installNow ? "install now" : "install at night",
                  v.offer.id, static_cast<unsigned long>((millis() - v.offer.receivedMs) / 1000));
    if (v.offer.bad[0]) Serial.printf("Offer problem %s\n", v.offer.bad);
  } else {
    Serial.println("Offered       nothing");
  }
  const uint32_t t = purifier::now();
  if (t) {
    const uint32_t s = istSecOfDay(t);
    Serial.printf("Night window  %02u:%02u-05:00 IST (now %02u:%02u IST)\n", hh(windowFrom_), mm(windowFrom_), hh(s), mm(s));
  } else {
    Serial.printf("Night window  %02u:%02u-05:00 IST (clock unknown)\n", hh(windowFrom_), mm(windowFrom_));
  }
  if (v.relId[0]) {
    char gen[12] = "-";  // the admin's Retry count; "-" until an offer of this release is heard
    if (v.relGen != GEN_UNKNOWN) snprintf(gen, sizeof(gen), "%lu", static_cast<unsigned long>(v.relGen));
    if (v.fails == NEVER) {
      Serial.printf("Tries         never again for release %s (retry gen %s)\n", v.relId, gen);
    } else {
      Serial.printf("Tries         %u of %u for release %s (retry gen %s)\n", static_cast<unsigned>(v.fails),
                    MAX_ATTEMPTS, v.relId, gen);
    }
  }
  Serial.printf("Last error    %s\n", v.lastErr[0] ? v.lastErr : "-");
  if (v.trial) {
    Serial.printf("Trial         %lu of %lu s of Wi-Fi used, server %s\n", static_cast<unsigned long>(v.wifiMs / 1000),
                  static_cast<unsigned long>(TRIAL_WIFI_MS / 1000), v.stateOk ? "answered" : "not reached yet");
  }
  if (v.force) Serial.println("ota now       armed: the offered update skips the night window once");
  Serial.printf("Memory        %lu bytes free, largest block %lu (needs %lu and %lu)\n",
                static_cast<unsigned long>(ESP.getFreeHeap()), static_cast<unsigned long>(ESP.getMaxAllocHeap()),
                static_cast<unsigned long>(MIN_FREE_HEAP), static_cast<unsigned long>(MIN_HEAP_BLOCK));
  Serial.println("--------------------------------");
}

void addStatusJson(JsonObject o) {
  const View v = view();
  const Why w = decide(v);
  o["state"] = stateName(v, w);
  // String copies: the document is serialized after v is gone.
  if (v.offer.present && w != Why::SameVersion) {
    o["offeredVersion"] = String(v.offer.version);
  } else {
    o["offeredVersion"] = nullptr;
  }
  if (v.lastErr[0]) {
    o["lastError"] = String(v.lastErr);
  } else {
    o["lastError"] = nullptr;
  }
}

}  // namespace ota
