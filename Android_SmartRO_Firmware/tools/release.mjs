#!/usr/bin/env node
// SmartRO firmware release tool. Signs purifier (ESP32) firmware for remote updates.
//
//   node tools/release.mjs sign                       sign the production build into dist/
//   node tools/release.mjs verify <bin> <manifest>    check a signed pair  [--pubkey <pem>]
//   node tools/release.mjs keygen                     make a signing key (brand-new setup only)
//
// Signature scheme. The server and the chip check exactly the same thing:
//   ECDSA P-256 over SHA-256 of the exact .bin bytes, DER signature, base64.
//   sha256 is lowercase hex.
//   keyFingerprint = first 16 hex chars of sha256(public key as SPKI DER).
//   Manifest: { version, size, sha256, signature, createdAt, keyFingerprint }
//
// The private key never leaves %USERPROFILE%\.smartro\. This tool reads it to
// sign and never prints, copies or moves it.
//
// Path overrides (for tests; normal use needs none):
//   SMARTRO_SIGNING_KEY    private key file  (default ~/.smartro/firmware-signing-key.pem)
//   SMARTRO_FIRMWARE_DIR   the Android_SmartRO_Firmware folder (default: this script's parent)
//   SMARTRO_BACKEND_PEM    backend copy of the public key
//                          (default <repo>/Android_SmartRO_Backend/keys/firmware-signing-public.pem)
//
// Node 18+, no dependencies.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FW_DIR = path.resolve(process.env.SMARTRO_FIRMWARE_DIR || path.join(HERE, '..'));
const REPO_DIR = path.resolve(FW_DIR, '..');
const PROJECT_DIR = path.join(FW_DIR, 'smartro_valve');
const INI_PATH = path.join(PROJECT_DIR, 'platformio.ini');
const BUILD_BIN = path.join(PROJECT_DIR, '.pio', 'build', 'production', 'firmware.bin');
const PUBKEY_H = path.join(PROJECT_DIR, 'src', 'ota_pubkey.h');
const BACKEND_PEM = path.resolve(
  process.env.SMARTRO_BACKEND_PEM ||
    path.join(REPO_DIR, 'Android_SmartRO_Backend', 'keys', 'firmware-signing-public.pem')
);
const DIST_DIR = path.join(FW_DIR, 'dist');
const KEY_PATH = path.resolve(
  process.env.SMARTRO_SIGNING_KEY || path.join(os.homedir(), '.smartro', 'firmware-signing-key.pem')
);

const ESP_IMAGE_MAGIC = 0xe9; // first byte of every ESP32 app image
const APP_DESC_MAGIC = 0xabcd5432; // esp_app_desc_t, right after the first segment header
const VERSION_RE = /^\d+\.\d+\.\d+$/;
// App slot size (bytes) of the partition tables we know. A bigger image can't be installed.
const APP_SLOT_BYTES = { 'min_spiffs.csv': 0x1e0000, 'default.csv': 0x140000 };

class Refusal extends Error {}
function refuse(msg) {
  throw new Refusal(msg);
}

/* ------------------------------------------------------------------ helpers */

const rel = (p) => {
  const r = path.relative(process.cwd(), p);
  return r && !r.startsWith('..') && !path.isAbsolute(r) ? r : p;
};
const mb = (n) => (n / (1024 * 1024)).toFixed(2) + ' MB';
const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const spkiDer = (pub) => pub.export({ type: 'spki', format: 'der' });
const fingerprint = (pub) => sha256Hex(spkiDer(pub)).slice(0, 16);

function isInside(dir, file) {
  const r = path.relative(dir, file);
  return Boolean(r) && !r.startsWith('..') && !path.isAbsolute(r);
}

function cmpVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

/** platformio.ini → Map(section → non-comment lines). */
function parseIni(text) {
  const sections = new Map([['', []]]);
  let cur = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const m = /^\[([^\]]+)\]$/.exec(line);
    if (m) {
      cur = m[1].trim();
      if (!sections.has(cur)) sections.set(cur, []);
      continue;
    }
    sections.get(cur).push(line);
  }
  return sections;
}

/** Value of `-D NAME=\"value\"` (or -DNAME="value") in a section's lines, or null. */
function defineIn(lines, name) {
  const re = new RegExp(`(?:^|\\s|')-D\\s*${name}=\\\\?"([^"\\\\]*)\\\\?"`);
  for (const l of lines ?? []) {
    const m = re.exec(l);
    if (m) return m[1];
  }
  return null;
}

function optionIn(lines, key) {
  for (const l of lines ?? []) {
    const m = /^([\w.]+)\s*=\s*(.*)$/.exec(l);
    if (m && m[1] === key) return m[2].trim();
  }
  return null;
}

function readIni() {
  if (!fs.existsSync(INI_PATH)) refuse(`Can't find ${INI_PATH}.`);
  const ini = parseIni(fs.readFileSync(INI_PATH, 'utf8'));
  const prod = ini.get('env:production');
  if (!prod) refuse('platformio.ini has no [env:production] section.');

  const version = defineIn(prod, 'FW_VERSION') ?? defineIn(ini.get('env'), 'FW_VERSION');
  if (!version) refuse('Could not find -D FW_VERSION=\\"x.y.z\\" in platformio.ini.');
  if (!VERSION_RE.test(version)) refuse(`FW_VERSION "${version}" must look like 1.2.3 (three numbers).`);

  const prodApi = defineIn(prod, 'API_BASE');
  if (!prodApi) refuse('[env:production] in platformio.ini has no API_BASE.');
  if (!prodApi.startsWith('https://')) refuse(`The production API_BASE must use https:// (it is ${prodApi}).`);

  // Every other server address in the file (env:lan and any test env) must
  // be absent from a customer build.
  const otherApis = new Map();
  for (const [name, lines] of ini) {
    if (name === 'env:production') continue;
    const v = defineIn(lines, 'API_BASE');
    if (v && v !== prodApi) otherApis.set(v, name);
  }

  const partitions =
    optionIn(prod, 'board_build.partitions') ?? optionIn(ini.get('env'), 'board_build.partitions');
  return { version, prodApi, otherApis, partitions };
}

function readHeaderPublicKey() {
  if (!fs.existsSync(PUBKEY_H)) refuse(`Can't find ${PUBKEY_H}.`);
  const text = fs.readFileSync(PUBKEY_H, 'utf8');
  const m = /OTA_PUBKEY_PEM\s*\[\s*\]\s*=([\s\S]*?);/.exec(text);
  if (!m) refuse(`${rel(PUBKEY_H)} has no OTA_PUBKEY_PEM[] = "...";`);
  const pem = [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)]
    .map((x) => x[1])
    .join('')
    .replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c));
  try {
    return { pem, key: crypto.createPublicKey(pem) };
  } catch (e) {
    refuse(`The public key in ${rel(PUBKEY_H)} can't be read (${e.message}).`);
  }
}

function readBackendPublicKey() {
  if (!fs.existsSync(BACKEND_PEM)) return null;
  try {
    return crypto.createPublicKey(fs.readFileSync(BACKEND_PEM, 'utf8'));
  } catch (e) {
    refuse(`The public key in ${rel(BACKEND_PEM)} can't be read (${e.message}).`);
  }
}

function loadPrivateKey() {
  if (!fs.existsSync(KEY_PATH)) {
    refuse(
      `No signing key at ${KEY_PATH}.\n` +
        '  Restore it from your offline backup (USB stick). Do NOT run keygen unless this is a\n' +
        '  brand-new setup: a new key means every purifier must be re-flashed by USB.'
    );
  }
  let key;
  try {
    key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  } catch (e) {
    if (e.code === 'ERR_MISSING_PASSPHRASE') refuse(`The key at ${KEY_PATH} is password-protected; this tool needs an unencrypted PKCS#8 key.`);
    refuse(`Could not read the signing key at ${KEY_PATH} (${e.code ?? 'unknown format'}).`);
  }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    refuse(`The key at ${KEY_PATH} is not an ECDSA P-256 key.`);
  }
  if (isInside(REPO_DIR, KEY_PATH)) {
    console.warn(`WARNING: the signing key is inside the repo folder (${KEY_PATH}). Move it out and never commit it.`);
  }
  return key;
}

/** Checks that apply to any ESP32 app image. Returns a list of problems. */
function imageProblems(bin) {
  const p = [];
  if (bin.length < 256) {
    p.push(`only ${bin.length} bytes; that is not a firmware image`);
    return p;
  }
  if (bin[0] !== ESP_IMAGE_MAGIC) {
    p.push(`starts with byte 0x${bin[0].toString(16).padStart(2, '0')}, not 0xE9; this is not an ESP32 app image (did you pick bootloader.bin or a merged image?)`);
    return p;
  }
  if (bin.readUInt32LE(32) !== APP_DESC_MAGIC) p.push('has no app description block; this is not an ESP32 app image');
  // byte 23 = hash_appended: the last 32 bytes are SHA-256 of everything before them.
  if (bin[23] === 1) {
    const body = bin.subarray(0, bin.length - 32);
    if (sha256Hex(body) !== bin.subarray(bin.length - 32).toString('hex')) {
      p.push("the image's built-in checksum doesn't match; the file is damaged or cut short");
    }
  }
  return p;
}

function newestSourceAfter(time) {
  const roots = [INI_PATH, ...['src', 'include', 'lib'].map((d) => path.join(PROJECT_DIR, d))];
  const newer = [];
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) walk(path.join(p, f));
    } else if (st.mtimeMs > time + 1000) {
      newer.push(p);
    }
  };
  roots.forEach(walk);
  return newer;
}

/* --------------------------------------------------------------------- sign */

function cmdSign() {
  const { version, prodApi, otherApis, partitions } = readIni();

  if (!fs.existsSync(BUILD_BIN)) {
    refuse(`No production build at ${rel(BUILD_BIN)}.\n  Build it first:  cd smartro_valve  then  pio run -e production`);
  }
  const bin = fs.readFileSync(BUILD_BIN);
  const binTime = fs.statSync(BUILD_BIN).mtimeMs;

  const probs = imageProblems(bin);
  if (probs.length) refuse(`${rel(BUILD_BIN)} ${probs.join('; ')}.`);

  const slot = partitions ? APP_SLOT_BYTES[partitions] : undefined;
  if (slot && bin.length > slot) {
    refuse(`The image is ${bin.length} bytes but the update slot (${partitions}) holds only ${slot}. Make the firmware smaller.`);
  }

  const stale = newestSourceAfter(binTime);
  if (stale.length) {
    refuse(
      'These files changed after the last production build:\n' +
        stale.slice(0, 6).map((f) => `    ${rel(f)}`).join('\n') +
        (stale.length > 6 ? `\n    ...and ${stale.length - 6} more` : '') +
        '\n  Build again (pio run -e production), then sign.'
    );
  }

  if (!bin.includes(Buffer.from(prodApi))) {
    refuse(
      `The build doesn't contain the production server address ${prodApi}.\n` +
        '  It is probably a LAN/test build. Build with:  pio run -e production'
    );
  }
  for (const [api, env] of otherApis) {
    if (bin.includes(Buffer.from(api))) {
      refuse(`The build contains the [${env}] server address ${api}. Customer firmware must not. Build with:  pio run -e production`);
    }
  }
  if (!bin.includes(Buffer.from(version))) {
    refuse(`The build doesn't contain its version text "${version}". Did you build after changing FW_VERSION? Run: pio run -e production`);
  }

  const header = readHeaderPublicKey();
  if (!bin.includes(Buffer.from(header.pem))) {
    refuse(
      `The build doesn't contain the update public key from ${rel(PUBKEY_H)}.\n` +
        '  A purifier running it could never install another remote update. Build again from the current source.'
    );
  }

  const outBin = path.join(DIST_DIR, `smartro_valve-${version}.bin`);
  const outManifest = path.join(DIST_DIR, `smartro_valve-${version}.release.json`);
  if (fs.existsSync(outBin) || fs.existsSync(outManifest)) {
    refuse(
      `Version ${version} was already signed (${rel(DIST_DIR)} has it). Every release needs a new version.\n` +
        '  Raise FW_VERSION in platformio.ini, build again, then sign.'
    );
  }
  const newer = listDistVersions().filter((v) => cmpVersion(v, version) > 0);

  // Keys: the private key, the chip's copy and the server's copy must all match.
  const priv = loadPrivateKey();
  const pubFromPriv = crypto.createPublicKey(priv);
  if (!spkiDer(pubFromPriv).equals(spkiDer(header.key))) {
    refuse(
      `The signing key does not match the public key in ${rel(PUBKEY_H)}.\n` +
        '  Chips would reject this update. Use the right key file, or fix ota_pubkey.h.'
    );
  }
  const backendKey = readBackendPublicKey();
  if (!backendKey) refuse(`Can't find the server's public key at ${BACKEND_PEM}.`);
  if (!spkiDer(pubFromPriv).equals(spkiDer(backendKey))) {
    refuse(
      `The signing key does not match ${rel(BACKEND_PEM)}.\n` +
        '  The server would reject the upload. Fix the server copy of the public key.'
    );
  }

  const signature = crypto.sign('sha256', bin, priv); // DER for EC keys
  if (!crypto.verify('sha256', bin, header.key, signature)) refuse('Signature check with the chip key failed.');
  if (!crypto.verify('sha256', bin, backendKey, signature)) refuse('Signature check with the server key failed.');

  const manifest = {
    version,
    size: bin.length,
    sha256: sha256Hex(bin),
    signature: signature.toString('base64'),
    createdAt: new Date().toISOString(),
    keyFingerprint: fingerprint(pubFromPriv),
  };

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(outBin, bin, { flag: 'wx' });
  fs.writeFileSync(outManifest, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });

  // Read back what was written and check it again.
  const problems = checkPair(fs.readFileSync(outBin), manifest, [['chip key', header.key]]).filter((c) => !c.ok);
  if (problems.length) refuse(`The written files failed their own check: ${problems.map((c) => c.what).join(', ')}`);

  console.log(`
Signed SmartRO firmware ${version}

  Firmware   ${outBin}
  Manifest   ${outManifest}
  Size       ${mb(bin.length)} (${bin.length} bytes)
  SHA-256    ${manifest.sha256}
  Key        ${manifest.keyFingerprint}

  Checks passed: production server ${prodApi}, no LAN/test address, ESP32 image,
  fits the update slot, contains version ${version} and the update key,
  signature verified with the chip key and the server key.
${newer.length ? `\n  NOTE: dist/ already has a newer version (${newer.join(', ')}). Purifiers on it won't move back to ${version}.\n` : ''}
Next steps
  1. Admin console -> Firmware updates -> upload BOTH files above.
  2. Click "Test", enter SR-TEST-0001, and turn on "Install now".
  3. Wait until SR-TEST-0001 shows "Installed" and still works.
  4. Turn "Install now" off, then click "All purifiers".
     Purifiers install at night, 02:00-05:00 IST.
  Full guide: smartro_valve/OTA.md
`);
}

function listDistVersions() {
  if (!fs.existsSync(DIST_DIR)) return [];
  return fs
    .readdirSync(DIST_DIR)
    .map((f) => /^smartro_valve-(\d+\.\d+\.\d+)\.release\.json$/.exec(f)?.[1])
    .filter(Boolean);
}

/* ------------------------------------------------------------------- verify */

/** All checks for a .bin + manifest pair. keys: [label, KeyObject][] */
function checkPair(bin, manifest, keys) {
  const checks = [];
  const add = (ok, what, detail = '') => checks.push({ ok, what, detail });

  add(typeof manifest.version === 'string' && VERSION_RE.test(manifest.version), 'version looks like x.y.z', String(manifest.version));
  add(manifest.size === bin.length, 'size matches', `manifest ${manifest.size}, file ${bin.length}`);
  const sha = sha256Hex(bin);
  add(manifest.sha256 === sha, 'sha256 matches', manifest.sha256 === sha ? sha : `manifest ${manifest.sha256}, file ${sha}`);
  const probs = imageProblems(bin);
  add(probs.length === 0, 'ESP32 app image', probs.join('; '));

  let sig = null;
  if (typeof manifest.signature === 'string' && /^[A-Za-z0-9+/]+=*$/.test(manifest.signature)) {
    sig = Buffer.from(manifest.signature, 'base64');
  }
  for (const [label, key] of keys) {
    let ok = false;
    try {
      ok = Boolean(sig) && crypto.verify('sha256', bin, key, sig);
    } catch {
      ok = false;
    }
    add(ok, `signature valid for the ${label}`, `key ${fingerprint(key)}`);
  }
  if (manifest.keyFingerprint !== undefined && keys.length) {
    const fps = keys.map(([, k]) => fingerprint(k));
    add(fps.includes(manifest.keyFingerprint), 'keyFingerprint matches', `manifest ${manifest.keyFingerprint}`);
  }
  return checks;
}

function cmdVerify(args) {
  let pubOverride = null;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pubkey') {
      pubOverride = args[++i];
      if (!pubOverride) refuse('--pubkey needs a file: --pubkey <public.pem>');
    } else files.push(args[i]);
  }
  if (files.length !== 2) refuse('Usage: node tools/release.mjs verify <firmware.bin> <manifest.release.json> [--pubkey <public.pem>]');
  const [binPath, manifestPath] = files;
  for (const f of [binPath, manifestPath]) if (!fs.existsSync(f)) refuse(`Can't find ${f}.`);

  const bin = fs.readFileSync(binPath);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    refuse(`${manifestPath} is not valid JSON (${e.message}).`);
  }

  const keys = [];
  if (pubOverride) {
    if (!fs.existsSync(pubOverride)) refuse(`Can't find the public key ${pubOverride}.`);
    keys.push(['given key', crypto.createPublicKey(fs.readFileSync(pubOverride, 'utf8'))]);
  } else {
    if (fs.existsSync(PUBKEY_H)) keys.push(['chip key (ota_pubkey.h)', readHeaderPublicKey().key]);
    const backend = readBackendPublicKey();
    if (backend) keys.push(['server key (backend PEM)', backend]);
    if (!keys.length) refuse('No public key found. Pass one with --pubkey <public.pem>.');
  }

  const checks = checkPair(bin, manifest, keys);
  const nameVer = /smartro_valve-(\d+\.\d+\.\d+)\.bin$/.exec(path.basename(binPath))?.[1];
  if (nameVer) checks.push({ ok: nameVer === manifest.version, what: 'file name matches version', detail: `${nameVer} vs ${manifest.version}` });

  console.log(`\nVerifying ${binPath}\n     with ${manifestPath}\n`);
  for (const c of checks) console.log(`  ${c.ok ? 'OK  ' : 'FAIL'}  ${c.what}${c.detail ? `  (${c.detail})` : ''}`);
  const bad = checks.filter((c) => !c.ok).length;
  console.log(bad ? `\nFAILED: ${bad} check(s). Do not upload this release.\n` : `\nAll checks passed: version ${manifest.version}, ${mb(bin.length)}.\n`);
  process.exitCode = bad ? 1 : 0;
}

/* ------------------------------------------------------------------- keygen */

function cmdKeygen() {
  if (fs.existsSync(KEY_PATH)) {
    refuse(
      `A signing key already exists at ${KEY_PATH}.\n` +
        '  Keep using it. A new key would mean re-flashing every purifier by USB.\n' +
        '  (If you really mean to replace it, move the old file away yourself first.)'
    );
  }
  if (isInside(REPO_DIR, KEY_PATH)) refuse(`Refusing to create the signing key inside the repo (${KEY_PATH}).`);

  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
  try {
    fs.chmodSync(KEY_PATH, 0o600);
  } catch {
    /* Windows: the file sits in your user profile, which only you can read */
  }

  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  const cLines = pem
    .trimEnd()
    .split('\n')
    .map((l) => `    "${l}\\n"`)
    .join('\n');

  console.log(`
New firmware signing key created
  Private key  ${KEY_PATH}   (never share it, never put it in the repo)
  Fingerprint  ${fingerprint(publicKey)}

Public key (PEM):
${pem}
Do these now:
  1. Back up the private key file to an offline USB stick and keep it somewhere safe.
     If it is lost, every purifier has to be re-flashed by USB.
  2. Put the public key into the chip firmware:
     ${rel(PUBKEY_H)} ->
static const char OTA_PUBKEY_PEM[] =
${cLines};
  3. Put the same PEM into the server:
     ${rel(BACKEND_PEM)}   (then redeploy the backend)
  4. Build the production firmware and flash EVERY purifier by USB once.
     Chips only accept updates signed with the key they were flashed with.
`);
}

/* --------------------------------------------------------------------- main */

function usage() {
  console.log(`SmartRO firmware release tool

  node tools/release.mjs sign
      Sign smartro_valve/.pio/build/production/firmware.bin.
      Writes dist/smartro_valve-<version>.bin and .release.json.
  node tools/release.mjs verify <firmware.bin> <manifest.release.json> [--pubkey <public.pem>]
      Check size, sha256 and signature.
  node tools/release.mjs keygen
      Make the signing key. Only for a brand-new setup.

Guide: Android_SmartRO_Firmware/smartro_valve/OTA.md`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'sign') cmdSign();
  else if (cmd === 'verify') cmdVerify(rest);
  else if (cmd === 'keygen') cmdKeygen();
  else {
    usage();
    if (cmd && cmd !== 'help' && cmd !== '--help' && cmd !== '-h') process.exitCode = 1;
  }
} catch (e) {
  if (e instanceof Refusal) {
    console.error(`\nREFUSED: ${e.message}\n`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
