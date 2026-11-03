// Public half of the SmartRO firmware signing key (ECDSA P-256).
// The chip installs a remote update only if its signature checks out with
// this key. The private half never goes in the repo; it lives on the release
// PC at %USERPROFILE%\.smartro\firmware-signing-key.pem.
// Same key as Android_SmartRO_Backend/keys/firmware-signing-public.pem.
// Generated 2026-11-03. Changing it means re-flashing every chip by USB.
#pragma once

static const char OTA_PUBKEY_PEM[] =
    "-----BEGIN PUBLIC KEY-----\n"
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWjE9Zq25DRvDgHUK7Nq+/mkta4aM\n"
    "w70mTM09uubkDQ9obtFQK39GsShFnlwpYEZlwYv2bLosCpRIsunDJIndtg==\n"
    "-----END PUBLIC KEY-----\n";
