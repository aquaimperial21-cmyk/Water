# SmartRO on a Hostinger VPS

One VPS runs everything: Postgres 18, the API, the admin console, and Caddy
(free HTTPS from Let's Encrypt). One address serves both:

| URL | Goes to |
|---|---|
| `https://<host>/api/v1/...`, `/health`, `/uploads/...` | API |
| `https://<host>/` | Admin console |

`<host>` is the VPS hostname Hostinger gives you, like `srv123456.hstgr.cloud`
(hPanel → VPS → Overview). All commands below run in **Git Bash** on your
laptop, from the repo folder.

---

## 1. Save the Railway data (before 2026-11-12)

Railway deletes the trial database around 2026-11-12.

1. Railway → upgrade to **Hobby** ($5). Open the **Postgres** service and
   press **Redeploy** if it shows offline.
2. Postgres service → **Variables** → copy `DATABASE_PUBLIC_URL`.
3. Run `bash deploy/hostinger/dump-railway.sh` and paste the URL.
   It saves `deploy/hostinger/backups/railway-<date>.dump`.
4. Backend service → **Variables** → copy the values of
   `FIREBASE_SERVICE_ACCOUNT_JSON` and any `RAZORPAY_*` / `MSG91_*` keys into
   your password manager. You need them in steps 3 and 6.

## 2. Buy the VPS

1. Hostinger → **VPS → KVM 2** (KVM 1 also works). OS: **Ubuntu 24.04**.
   Location: India if offered.
2. Set a root password. Optional but easier: add your SSH public key.
3. Note the **IP** and **hostname** from hPanel → VPS → Overview.

## 3. Add the Firebase key

Save the key as `deploy/hostinger/secrets/firebase-service-account.json`
(this folder is gitignored). Get it from Railway's
`FIREBASE_SERVICE_ACCOUNT_JSON` value, or Firebase console → Project settings
→ Service accounts → **Generate new private key**.

## 4. Deploy

```bash
SERVER=root@<VPS-IP> bash deploy/hostinger/deploy.sh
```

First run: about 10 minutes. It installs Docker, creates `/opt/smartro/.env`
with fresh secrets, builds, starts, and prints the live URLs. If the VPS
hostname isn't a full domain, add `PUBLIC_HOST=srvXXXXXX.hstgr.cloud` before
`SERVER=...`.

Check: `https://<host>/health` shows `{"data":{"ok":true,...}}`.

## 5. Copy the Railway data in

```bash
SERVER=root@<VPS-IP> bash deploy/hostinger/restore-db.sh deploy/hostinger/backups/railway-<date>.dump
```

Type `yes`. It prints user/subscription/device/payment counts, then the
API applies migrations newer than Railway's. Log in to the admin at
`https://<host>/` with the old admin password.

## 6. Add payment / SMS keys (when ready)

```bash
ssh root@<VPS-IP>
nano /opt/smartro/.env      # fill RAZORPAY_*, set PAYMENT_DRIVER=razorpay
smartro up -d
```

Razorpay dashboard → Webhooks → URL `https://<host>/api/v1/webhooks/razorpay`.

## 7. Point the app and firmware at the new address

The old Railway URL is in `Android_SmartRO_Frontend/eas.json`,
`Android_SmartRO_Frontend/src/api/client.ts` and
`Android_SmartRO_Firmware/smartro_valve/platformio.ini`. Replace it with
`https://<host>/api/v1`, then make a new EAS build. After a week on
Hostinger with no problems, cancel Railway.

---

## Day to day

| Task | Command |
|---|---|
| Ship new code | `SERVER=root@<VPS-IP> bash deploy/hostinger/deploy.sh` |
| See status | `ssh root@<VPS-IP> smartro ps` |
| Follow API logs | `ssh root@<VPS-IP> smartro logs -f api` |
| Restart API | `ssh root@<VPS-IP> smartro restart api` |
| Database shell | `ssh -t root@<VPS-IP> smartro exec db psql -U smartro` |
| Make an admin | `ssh -t root@<VPS-IP> "smartro exec -e ADMIN_EMAIL=you@example.in -e ADMIN_PASSWORD='...' api npm run admin:create"` |
| Download last night's backup | `ssh root@<VPS-IP> cat /opt/smartro/backups/daily-<YYYYMMDD>.dump > smartro.dump` |

Backups run every night at 03:00 IST into `/opt/smartro/backups/` and are
kept 14 days. They sit on the same VPS, so download one now and then.

## Good to know

- The `srvXXXXXX.hstgr.cloud` address is tied to this VPS. If you later move
  to your own domain, set `PUBLIC_HOST` + `CORS_ORIGINS` in `/opt/smartro/.env`,
  run `smartro up -d --build`, and rebuild the app and firmware.
- Caddy is locked to Let's Encrypt because the ESP32 firmware trusts only
  Let's Encrypt roots.
- Postgres has no open port. Only the API container can reach it.
- New JWT secrets mean customers log in once more after the move.
