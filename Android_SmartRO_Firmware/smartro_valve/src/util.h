// Small helpers: HMAC, random hex, UTC time strings.

#pragma once

#include <Arduino.h>

// Lowercase hex HMAC-SHA256 of msg, keyed with the UTF-8 bytes of key.
String hmacSha256Hex(const String &key, const String &msg);

// 2 * bytes lowercase hex characters from the hardware random generator.
String randomHex(size_t bytes);

// Compares two strings in time that doesn't depend on where they differ.
bool sameSecret(const String &a, const String &b);

// Parses "2026-10-26T04:06:31.265Z" (UTC, as JavaScript's toISOString writes it).
bool parseIsoUtc(const char *s, uint32_t &epochOut);

// "2026-10-26T04:06:31Z"
String formatIsoUtc(uint32_t epoch);

// Last 6 hex digits of the Wi-Fi MAC, lowercase. Used in names: smartro-a1b2c3.
String macSuffix();
