# Remote firmware updates (OTA)

This guide shows how to send new firmware to purifiers over Wi-Fi, without opening them.
You need three things: this repo, PlatformIO, and the admin console (**Firmware updates** page).

## How an update reaches a purifier

1. You build the firmware and **sign** it on your PC. Only your PC has the signing key.
2. You upload the two signed files in the admin console. A new release starts **Off**.
3. You switch it on: first for one **Test** purifier, then for **All purifiers**.
4. Each purifier checks in with the server about once an hour. The server's answer tells it about the update.
5. The purifier waits for the night window (**02:00–05:00 IST**). Then it downloads the file.
6. It checks the file's SHA-256 and signature. If either is wrong, it throws the file away and keeps its old firmware.
7. It restarts into the new firmware. The new firmware must reach the server within 10 minutes. If it can't, the purifier goes back to the old firmware by itself.

The water keeps working during the download. Only the restart stops it, for a few seconds.

What the status words on the admin page mean:

| Status | Meaning |
|---|---|
| Offered | The purifier was told about the update. It is waiting (usually for the night window). |
| Downloading | It is downloading and checking the file. |
| Installed | It is running the new version and has reached the server. Done. |
| Failed | The download or a check failed. The old firmware is still running. It tries again later. |
| Rolled back | The new firmware crashed or couldn't reach the server. The purifier went back to the old firmware. |

## One-time step: flash every chip by USB with 1.1.0 or newer

Remote updates need firmware **1.1.0 or newer** on the chip. Older chips don't know how to update themselves.

So every purifier must be flashed **by USB once** with a production build of 1.1.0+:

1. Plug the ESP32 into your PC.
2. In the PlatformIO sidebar: smartro_valve → **env:production** → **Upload**.
3. Open **Monitor** and type `status`. Check the firmware version, serial and Wi-Fi.

The saved Wi-Fi, serial and token stay on the chip. After this, every later update can go over Wi-Fi.

The admin page shows chips that still need this: the **Older than 1.1.0** filter, and "USB flash needed" in the Version column.

## Release an update, step by step

Do these in order. Don't skip the test.

1. **Raise the version.** In `platformio.ini`, change `FW_VERSION`, for example `1.1.0` → `1.2.0`.
   Every release needs a new, higher number. A number can never be reused.
2. **Build the production firmware.** In the `smartro_valve` folder:
   ```
   pio run -e production
   ```
   Run it in a PlatformIO terminal. Or use the PlatformIO sidebar: env:production → **Build** (not Upload).
3. **Sign it.** In the `Android_SmartRO_Firmware` folder:
   ```
   node tools/release.mjs sign
   ```
   It writes two files into `Android_SmartRO_Firmware/dist/`:
   `smartro_valve-1.2.0.bin` and `smartro_valve-1.2.0.release.json`.
   It refuses if something is wrong. See [What `sign` checks](#what-sign-checks).
4. **Upload.** Admin console → **Firmware updates** → *Upload a release*.
   Pick the `.bin`, then the `.release.json`. Check that the version and size look right. Add a note. Click **Upload**.
5. **Test on one purifier.** On the new release's row, click **Test**. Enter `SR-TEST-0001` and save.
   Then turn on **Install now (skip night window)**.
6. **Make the test purifier check in.** Unplug it for a few seconds, or type `reboot` in its serial monitor.
   With the monitor open you can type `ota` to watch the update.
7. **Check it worked.** In the *Purifiers* table, SR-TEST-0001 should go Offered → Downloading → **Installed**,
   and its Version should show `1.2.0`. Turn the water off and on from the app to be sure it still works.
8. **Turn off Install now** on that release.
9. **Send it to everyone.** Click **All purifiers**. The dialog says how many purifiers it will reach. Confirm.
10. **Next morning,** open the page and pick the **Failed / rolled back** filter. It should be empty.

Purifiers that are offline at night simply update on a later night.

## The night window

| "Install now" | When purifiers install |
|---|---|
| Off (normal) | Between **02:00 and 05:00 IST**, when nobody is using water. |
| On | At their next check-in, even in the daytime. **For testing only.** |

Never leave "Install now" on with **All purifiers**: every home would get a restart during the day.

If two releases are switched on, each purifier gets the most recently uploaded one that applies to it.

## If an update is bad

The purifier protects itself:

| Problem | What the purifier does | Admin page shows |
|---|---|---|
| File damaged, or not signed with our key | Refuses it before installing. Old firmware keeps running. | Failed |
| New firmware crashes, or restarts before it reaches the server | Goes back to the old firmware on its own. | Rolled back |
| New firmware can't reach the server for 10 minutes while Wi-Fi is up | Goes back to the old firmware. | Rolled back |
| Home Wi-Fi is down | Waits. This doesn't count against the update. | (no change) |
| 3 failed tries | Stops trying. Keeps the old firmware. | Failed, "Stopped trying" |

What you do:

1. Click **Off** on the bad release. No purifier is offered it any more.
2. Find the cause on SR-TEST-0001 with the serial monitor open.
3. Fix it, raise the version (for example `1.2.1`), and release that the normal way, starting with Test.
   Don't try to "go back" to an older version number. To undo a change, release the old code under a new, higher number.
4. **Retry** (on a purifier's row) starts its tries again from zero. Use it only after you fixed the cause,
   for example the purifier's Wi-Fi, or after you released a fixed version.

## Serial monitor commands

Open PlatformIO **Monitor** with the purifier plugged in by USB.

| Command | What it does |
|---|---|
| `ota` | Shows the update details: what is offered, how far it got, and the last error. |
| `ota now` | Lets the offered update skip the night window (and the wait after a failure), once. |
| `status` | One-line summary, including the firmware version and update state. |
| `reboot` | Restarts. The purifier checks in with the server right away. |

## Back up the signing key

> **The signing key is the only thing that can make updates the purifiers accept.**
>
> - It lives on the release PC at `%USERPROFILE%\.smartro\firmware-signing-key.pem`.
> - **If it is lost, no purifier can be updated remotely again.** Every chip would have to be opened and re-flashed by USB with a new key.
> - **If someone else gets it,** they could sign firmware your purifiers accept. Then make a new key and re-flash every chip.
> - Keep an **offline backup**, for example on a USB stick in a safe place. Check the backup once.
> - **Never** email it, put it in chat, cloud drives or the repo, or copy it to the server. The server only needs the public key.

The public half is safe to share. It is in `src/ota_pubkey.h` (chip) and `Android_SmartRO_Backend/keys/firmware-signing-public.pem` (server).
Its fingerprint is `1825f759d433d6a2`. Every `.release.json` shows the fingerprint of the key that signed it.

`node tools/release.mjs keygen` makes a new key. It is **only for a brand-new setup**. It refuses if a key already exists.
A new key means: update both public key files, redeploy the server, and re-flash **every** chip by USB.

## What `sign` checks

`node tools/release.mjs sign` refuses to sign unless:

| Check | Why |
|---|---|
| The build contains the production server address from `[env:production]` | Stops a LAN/test build from reaching customers. |
| It doesn't contain the `[env:lan]` address | Same. |
| It starts with byte `0xE9` and its built-in checksum is right | It's a real, complete ESP32 app image. |
| It fits the update slot (1.88 MB) | A bigger image can't be installed. |
| No source file or `platformio.ini` changed after the build | You're signing what you just built. |
| It contains its own version text and the update public key | The version was really raised, and this firmware can accept the next update. |
| That version isn't in `dist/` yet | Versions must be unique. |
| The signing key matches `ota_pubkey.h` and the server's public key | Chips and server will accept the signature. |

To check a pair of files by hand:

```
node tools/release.mjs verify dist/smartro_valve-1.2.0.bin dist/smartro_valve-1.2.0.release.json
```

## Without the admin console (server fallback)

If the admin page isn't working, you can do the same from a terminal on your PC.
Replace `1.2.0` with your version.

1. Copy both files to the server, then into the API container:
   ```
   scp dist/smartro_valve-1.2.0.bin dist/smartro_valve-1.2.0.release.json root@187.127.176.28:/tmp/
   ssh root@187.127.176.28 "smartro cp /tmp/smartro_valve-1.2.0.bin api:/tmp/ && smartro cp /tmp/smartro_valve-1.2.0.release.json api:/tmp/"
   ```
2. Add the release (it starts Off). The note at the end is optional:
   ```
   ssh -t root@187.127.176.28 "smartro exec api npm run firmware:add -- /tmp/smartro_valve-1.2.0.bin /tmp/smartro_valve-1.2.0.release.json 'What changed'"
   ```
3. Roll it out:

   | Step | Command |
   |---|---|
   | Test, install now | `ssh -t root@187.127.176.28 "smartro exec api npm run firmware:rollout -- 1.2.0 TEST SR-TEST-0001 --now"` |
   | All purifiers, at night | `ssh -t root@187.127.176.28 "smartro exec api npm run firmware:rollout -- 1.2.0 ALL"` |
   | Off | `ssh -t root@187.127.176.28 "smartro exec api npm run firmware:rollout -- 1.2.0 OFF"` |

   Without `--now`, "Install now" is turned off. The serial list (comma-separated) replaces the test list; leave it out to keep the current one.

## Troubleshooting

| What you see | Likely cause | What to do |
|---|---|---|
| `sign`: "doesn't contain the production server address" or "contains the [env:lan] server address" | You built the LAN/test firmware. | `pio run -e production`, then sign again. |
| `sign`: "files changed after the last production build" | You edited something after building. | Build again, then sign. |
| `sign`: "already signed" / upload: "already exists" | That version was released before. | Raise `FW_VERSION`, build, sign. |
| `sign`: "doesn't contain its version text" | You raised the version but didn't rebuild. | `pio run -e production`. |
| `sign`: "doesn't contain the update public key" | The build is older than the OTA firmware, or the key file was changed. | Build again from the current source. |
| `sign`: "No signing key" | The key file is missing on this PC. | Restore it from your USB backup. **Don't** run keygen. |
| `sign`: "signing key does not match" | A different key file, or a changed `ota_pubkey.h` / server PEM. | Use the right key from the backup. Never "fix" this by editing the public key files. |
| Upload: "File size differs" or "SHA-256 doesn't match" | The `.bin` and `.json` are from different builds. | Pick both files with the same version from `dist/`. |
| Upload: signature error from the server | Files were changed after signing, or signed with another key. | Sign again and upload the new files. |
| Page says the server doesn't have firmware updates yet (404) | The backend isn't deployed with OTA support yet. | Deploy the latest backend, then refresh. |
| Purifier stays **Offered** | It's waiting for the night window, or is offline. | Normal. For a test, turn on Install now and unplug it for a few seconds, or type `ota now`. |
| Purifier shows no update at all | It isn't in the test list, hasn't checked in yet, or runs firmware older than 1.1.0. | Check the test list and its Version column. Older chips need the USB flash. |
| **Failed** with a signature or SHA-256 error | The file is damaged, or signed with the wrong key. | Don't Retry. Turn the release Off and sign/upload it again. |
| **Failed** with a download or time-out error | Weak Wi-Fi. | It retries by itself. After 3 tries, fix the Wi-Fi and press Retry. |
| **Rolled back** | The new firmware crashed, or couldn't reach the server for 10 minutes. | Turn the release Off. Reproduce on SR-TEST-0001 with the monitor open. Release a fixed, higher version. |
| Last seen shows **Offline** | No check-in for 90 minutes. | Check the purifier's power and Wi-Fi. It updates once it's back. |

## Reference

- Signature: ECDSA P-256 over SHA-256 of the exact `.bin` bytes, DER, base64. `sha256` is lowercase hex.
- Manifest (`.release.json`): `version`, `size`, `sha256`, `signature`, `createdAt`, `keyFingerprint`
  (first 16 hex characters of the SHA-256 of the public key's SPKI DER).
- Files: [`../tools/release.mjs`](../tools/release.mjs) (sign/verify/keygen), [`src/ota.h`](src/ota.h) (purifier side),
  [`src/ota_pubkey.h`](src/ota_pubkey.h) (public key built into the chip).
