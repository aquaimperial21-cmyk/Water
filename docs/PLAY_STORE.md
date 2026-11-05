# Google Play readiness: SmartRO customer app (`in.smartro.customer`)

Checked 3 Nov 2026 against `Frontend` (Expo SDK 51, RN 0.74.5, EAS, no `android/` folder) and current Google policy. Numbers in [brackets] point to Sources at the end.
Operator: **Mahesh Enterprises** (sole proprietorship), Ahmednagar, Maharashtra. Production API: `https://srv2122898.hstgr.cloud/api/v1`. `/health` returned 200 on 3 Nov; `/privacy`, `/terms` and `/delete-account` returned 404.

**Verdict:** Play would refuse the upload today. The app targets API 34, but Play has required API 36 since 31 Aug 2026, and the last extension ran out on 1 Nov 2026 [1]. Policy pages, account deletion and reviewer access also have to be finished before review.

---

## 1. Blockers (each one stops a release or causes a rejection)

| # | Blocker | Evidence | Fix | Owner |
|---|---|---|---|---|
| B1 | **Target API 34 < required 36** | RN 0.74.5 defaults are `targetSdk 34 / compileSdk 34 / AGP 8.2.1 / NDK 26` (`node_modules/react-native/gradle/libs.versions.toml`). `expo-build-properties` in `app.json` sets only `minSdkVersion: 24`. Play requires API 36 for new apps and updates from 31 Aug 2026; the extension ended 1 Nov 2026 [1] | Upgrade Expo SDK (option B below) | Dev |
| B2 | **No privacy policy URL** | `<website>/privacy` is not live. In-app links point to `https://srv2122898.hstgr.cloud/privacy` (`src/utils/legal.ts`), which returns 404 | Publish the website pages. Put the final URL in `SITE_URL` and in the Play listing | Owner + Dev |
| B3 | **Account deletion incomplete** | The backend has `POST /auth/account/delete` (`services/account-deletion.ts`), but the in-app button and `<website>/delete-account` are still being built | See §2 | Dev |
| B4 | **Phone OTP will fail in Play-installed builds** | Play re-signs the app with its own key. Firebase phone auth needs the app's SHA-256 (Play Integrity) and SHA-1 [20]. `google-services.json` (project `aqua-32b1d`) contains no certificate hashes. If the reviewer can't log in, the app is rejected | Add the SHA-1 and SHA-256 of both the **Play app-signing key** and the **EAS upload key** in Firebase → Project settings, and enable the Play Integrity API | Dev |
| B5 | **No reviewer login** | Login is OTP-only by default. Play needs reusable sign-in details that bypass OTP and work from any location [11] | Demo account + Firebase test number (§4) | Dev |
| B6 | **Production access gate (personal accounts only)** | Personal accounts created after 13 Nov 2023 must run a closed test with ≥12 testers opted in for 14 continuous days before they can publish to production [9] | Use an organization account (§5), or run the closed test | Owner |

### B1: how to get to API 36

| Option | What to change | Risk |
|---|---|---|
| A. Stay on SDK 51 and force it | In `app.json` → `expo-build-properties.android`, add `"compileSdkVersion": 36, "targetSdkVersion": 36, "buildToolsVersion": "36.0.0"` | **Not recommended.** AGP 8.2.1 and NDK 26 were never meant to compile against API 36, so the build may simply fail. Nobody has tested RN 0.74 at that target. Edge-to-edge is forced at API 35+ and can't be turned off at 36, which breaks layouts and `softwareKeyboardLayoutMode: "resize"`. The prebuilt Hermes/RN `.so` files are 4 KB-aligned, so updates get blocked again from **1 Feb 2027** [2] |
| **B. Expo SDK 54 (RN 0.81)**, recommended now | On a branch: `npx expo install expo@^54.0.0 --fix`, upgrade `@react-native-firebase/*` to a version that supports RN 0.81, keep `newArchEnabled: false` (SDK 54 is the last SDK with the Legacy Architecture [4]), keep Reanimated 3.x and FlashList 1.x (Reanimated 4 needs the New Architecture [4]). After prebuild, confirm the output says `targetSdkVersion 36` | SDK 54 targets API 36 and edge-to-edge can't be disabled [4], so every screen and the keyboard behaviour need a retest. It meets the 16 KB rule (SDK 53+ [3]). It is already 4 SDKs behind; the next upgrade forces the New Architecture. About 2–4 dev days plus 1–2 days of device testing |
| C. Latest Expo SDK 58 (RN 0.88, released 21 Oct 2026 [5]) | Same command with `expo@^58.0.0`. New Architecture is required from SDK 55 [4] | Most future-proof. `react-native-razorpay@3.0.0` is an old bridge module that would run through the interop layer, so payments need an end-to-end test (UPI, card, autopay). Moti and Reanimated 4 need migration. About 4–7 dev days |

**16 KB pages:** All apps targeting API 35+ must support 16 KB pages; updates without it can't be released from **1 Feb 2027** [2]. RN supports 16 KB from 0.77, Expo from SDK 53 [3]. Options B and C cover it. Check with `bundletool dump config --bundle app.aab | grep alignment` (should print `PAGE_ALIGNMENT_16K`) or in Play Console → App bundle explorer. The Razorpay SDK ships no `.so` files (checked on Maven).

### Must fix before submitting (high rejection risk or irreversible)

- [ ] **Package name is permanent after the first upload.** `in.smartro.customer` is tied to Firebase and EAS credentials. Confirm you're happy with it before uploading.
- [ ] **Name consistency.** `app.json` `"name": "SmartRO"` is what shows under the launcher icon; the brand is "Aqua Imperial"/"ImperialAqua". The store title, launcher name, deletion page and privacy policy must all use the same name [6]. Also confirm you have the right to use "SmartRO" (Play's impersonation and IP policies).
- [ ] **Dead UI (minimum-functionality risk).** In `ProfileScreen.tsx`, the rows "Home" address, "Add another address", "Personal details", "Notifications" and "Payment methods" all have `onPress={() => {}}`. Hide them or make them work.
- [ ] **Misleading claim.** The photo slots in `NewTicketScreen.tsx` don't open a picker, yet the text says "Photos are only seen by your assigned technician. Deleted after 90 days." Remove the slots and the text until photos really work, then declare Photos in the Data safety form.
- [ ] **Referral link.** The share text uses `https://smartro.in/app`. Make sure it resolves, or use `https://play.google.com/store/apps/details?id=in.smartro.customer`.
- [ ] **Version.** Change `expo.version` from `0.1.0` to `1.0.0` (this is the version name shown on Play). `versionCode` is handled by EAS (`appVersionSource: remote` with `autoIncrement` on the production profile), so leave it alone.
- [ ] **Signing.** New apps must use an AAB with Play App Signing. EAS's `production` profile already builds an AAB (it has no `buildType`). Download a backup of the EAS upload keystore with `eas credentials`.
- [ ] **Push.** Upload the FCM V1 service-account key to EAS (`eas credentials` → Android → FCM V1), otherwise push notifications won't arrive in production builds [21].
- [ ] **Backend uptime.** The Hostinger API must stay up throughout review. A dead API means a broken app and a rejection.

### Permissions (from installed library manifests; confirm in the merged manifest after prebuild)

| Permission | Comes from | Sensitive? | Action |
|---|---|---|---|
| INTERNET, ACCESS_NETWORK_STATE, WAKE_LOCK | RN, `@react-native-firebase/auth` | No | Keep |
| POST_NOTIFICATIONS (runtime prompt) | `expo-notifications` | Runtime, normal | Keep (service and billing reminders; asked in `src/utils/push.ts`) |
| RECEIVE_BOOT_COMPLETED | `expo-notifications` | No | Keep |
| VIBRATE | `expo-haptics` | No | Keep |
| NFC (`uses-feature required="false"`) | Razorpay `standard-core` 1.7.22 | No | Keep. Phones without NFC are not filtered out |
| READ_ / WRITE_EXTERNAL_STORAGE | `expo-file-system` (pulled in by Expo), possibly the Expo template too | Legacy storage | **Block.** The app never touches files |
| SYSTEM_ALERT_WINDOW | Possibly the Expo prebuild template (*unverified*) | Special permission | **Block** |
| Location, camera, contacts, SMS, READ_PHONE_STATE, QUERY_ALL_PACKAGES, AD_ID | Not declared by any installed library. Firebase reads OTPs through the SMS Retriever API, which needs no permission | — | Confirm they're absent from the merged manifest |

Add to `app.json` → `expo.android`: `"blockedPermissions": ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.SYSTEM_ALERT_WINDOW"]` [23].
Google's SDK Index lists location and phone-state permissions for an older Razorpay version. The current `standard-core` manifest (1.7.22, which `checkout:1.6.41` pulls in as `LATEST`) declares only INTERNET and NFC. Because it floats on `LATEST`, builds aren't reproducible; pinning it is worth considering.
Note for later: once the app targets API 37 (Android 17), reaching the purifier on the LAN will need the runtime `ACCESS_LOCAL_NETWORK` permission [24]. Nothing to do yet.

### Cleartext HTTP

- [x] `expo-build-properties` sets `usesCleartextTraffic: true` globally. **It is needed in production**: `src/utils/localPurifier.ts` controls the ESP32 over `http://<LAN-IP>` (commands are HMAC-signed and the customer's JWT is never sent). Android's network security config can't allow "any private IP", so the switch has to stay on. Play does not reject an app just for allowing cleartext.
- [x] The production API is HTTPS: `eas.json` production and preview profiles use `https://srv2122898.hstgr.cloud`, and release builds never fall back to a loopback address (`src/api/client.ts`).
- [ ] **Only ever upload builds from the `production` profile.** The `lan` and `development` profiles point at `http://192.168.1.21:4000` and must never reach Play.

---

## 2. Account deletion [6]

| Requirement | Status | To do |
|---|---|---|
| In-app path, easy to find (e.g. Profile → Delete account) | Backend done. `Auth.deleteAccount()` and `LEGAL_URLS.deleteAccount` are being wired up; the button isn't there yet | Finish the button, the confirmation step and sign-out |
| Web page where people can ask for deletion without the app | `<website>/delete-account` returns 404 | The page must name the app as it appears on the store and "Mahesh Enterprises", and offer a form or email |
| Any required steps first must be clearly listed | The backend refuses deletion while a plan is running, the purifier hasn't been collected, or a refund is pending | Spell out these steps on the page and in the app, with a support contact |
| Delete the user's data, and ask service providers to do the same | Addresses, KYC, push tokens, notifications and sessions are deleted; the user is anonymised | **Gap 1:** the Firebase Auth user (which holds the phone number) is not deleted. Call `getAuth().deleteUser(firebaseUid)` before clearing the field. **Gap 2:** ticket descriptions and ratings stay; erase them or disclose that they're kept |
| Explain what is kept | Bookings, payments and invoices are kept up to 8 years (Indian tax law) under an anonymous record | State this in the privacy policy and on the deletion page |

**What to enter in Play Console → App content → Data safety → Data deletion:**
- Can users create an account? **Yes** (phone OTP, optional password).
- Delete-account URL: `<website>/delete-account`.
- Can users ask to delete some data without deleting the account? **No**, unless you offer that through support.

---

## 3. Data safety form [7]

Overall answers: collects data **Yes**. All user data encrypted in transit **Yes** (backend over HTTPS via Caddy, Firebase, Razorpay and Expo all use HTTPS; the LAN valve commands carry no personal data). Users can request deletion **Yes**. **"Shared" is No everywhere**, because Razorpay, Firebase, Expo/FCM and Hostinger only process data on the operator's behalf, which Play exempts as service providers [7]. Technicians are part of the operator's own business.

| Play data type | Collected | Purpose(s) | Required / optional | Removed on account deletion |
|---|---|---|---|---|
| Personal › Name | Yes (sign-up, required) | App functionality, Account management | Required | Yes |
| Personal › Phone number | Yes (OTP via Firebase) | App functionality, Account management, Fraud prevention | Required | Yes in our DB; Firebase user still needs deleting (Gap 1) |
| Personal › Email | Yes if entered (passed to Razorpay prefill) | App functionality (receipts), Account management | Optional | Yes |
| Personal › User IDs | Yes (account ID, referral code, Firebase UID) | Account management | Required | Yes |
| Personal › Address | Yes (city and pincode in the app; installation address) | App functionality (delivery and installation) | Required to book | Yes |
| Personal › **Other info**: PAN + last 4 digits of Aadhaar | Yes (KYC at booking) | Fraud prevention, security & compliance; Account management | Required to book | Yes |
| Financial › User payment info | Yes. Entered in the Razorpay SDK inside the app; our backend never sees card or UPI details | App functionality, Fraud prevention | Required to pay | Razorpay keeps it under RBI rules |
| Financial › Purchase history | Yes (bookings, payments, invoices, plans) | App functionality, Account management | Required | Kept up to 8 years, anonymised (tax law) |
| App activity › Other user-generated content | Yes (ticket text, ratings and comments, help requests) | App functionality (support) | Optional | Help messages yes; ticket text not yet (Gap 2) |
| App activity › App interactions | Yes, by the Razorpay SDK on its checkout screens [18] | App functionality, Fraud prevention | Required to pay | n/a |
| App activity › Installed apps | Yes, by the Razorpay SDK to detect UPI apps [18] | App functionality | Required for UPI-app payments | n/a |
| Device or other IDs | Yes (Expo/FCM push token and Expo install ID; Firebase Auth IP address and user agent [19]) | App functionality (push), Fraud prevention & security | Push is optional; Firebase part required | Push tokens yes |
| Location (approximate or precise) | **No.** No location permission or SDK | — | — | — |
| Photos, videos, files | **No.** Ticket photo slots are placeholders | — | — | — |
| Crash logs, diagnostics | **No.** No crash or analytics SDK. The only `@firebase/analytics` in the lockfile is the unused JS SDK; Razorpay sends these only if configured | — | — | — |
| Messages, contacts, calendar, health, audio, web history | **No** | — | — | — |

**Uncertain points:**
- Play has no "Government ID" type; "Other info" is the closest fit [7].
- For **payment info**, Play says card data collected directly by a payment service "generally" doesn't need declaring [7], but Razorpay's own guidance says its SDK collects it and the merchant must declare [18]. Declaring it, as above, is the safe choice.

---

## 4. Other App content declarations

| Form | Answer |
|---|---|
| Content rating (IARC) | Category "All Other App Types". Answer **No** to violence, sexuality, language, drugs, gambling (referral rewards are discounts, not gambling), user-to-user interaction or communication (tickets go to the company), location sharing, and digital purchases. Expect a 3+/Everyone rating [16] |
| Target audience | **18 and over only**, so the Families policy doesn't apply. Keep childish imagery out of store graphics [15]. Optionally turn on "Restrict minor access" |
| Ads | **No.** There's no ad SDK. The home banners promote the operator's own plans; Play's "house ads" example is about promoting your other apps [14] |
| Financial features | "**My app doesn't provide any financial features**" [13]. The app only takes payment for its own rental through a gateway. *Uncertain:* if Play objects to referral credits, choose "Rewards, points… and other incentives" |
| Health apps | "No health features" (TDS readings are about water quality). Every app must fill this in [17] |
| Government apps / News / Advertising ID | No / No / No (no AD_ID permission; confirm in the merged manifest) |
| Payments policy | **Razorpay is allowed.** Play Billing "must not be used" when the payment is mainly for renting or buying physical goods or physical services [8]. A purifier rental plus installation and maintenance (including UPI autopay rent) fits. Never sell digital-only items in the app |

**Reviewer access (App access → "All or some functionality is restricted"):**
1. Firebase → Authentication → Phone → *Phone numbers for testing*: add a fictional +91 number with a fixed 6-digit code. Up to 10 numbers are allowed, no SMS is sent and quota isn't used [20]. Don't hardcode it in the app.
2. Sign in once with that number in a Play-installed build, then use Profile → "Set a password". Customer password login exists (`/auth/password/login`) and allows 5 attempts per 15 minutes.
3. In the admin panel, give the demo account an active plan, invoices and a ticket so every screen has data. The water switch needs real hardware; explain that.
4. Text for Play Console (in English): *"Tap 'Sign in with password'. Phone: +91XXXXXXXXXX, password: ••••. Or enter the same phone number and OTP 123456 (fixed test code). The demo account has an active rental. Payments go through Razorpay for a physical purifier rental; no payment is needed to review. 'Water ON/OFF' controls a purifier on the home Wi-Fi and shows 'not reachable' without the device."*

---

## 5. Store listing and account checklist

| Item | Spec [12] | Status / action |
|---|---|---|
| App name | ≤30 characters | Must match the launcher name (see "Name consistency" above) |
| Short description | ≤80 characters | E.g. "RO water purifier on rent: book, pay, track filters & get service at home." |
| Full description | ≤4000 characters, no "#1/best", no keyword stuffing | Cover plans, deposit/refund, service area (Ahmednagar), KYC, autopay, Wi-Fi switch |
| App icon | 512×512, 32-bit PNG with alpha, ≤1 MB | `assets/icon.png` is 1024×1024 RGB; export a 512 version with alpha |
| Feature graphic | 1024×500, JPEG or 24-bit PNG, no alpha | To do |
| Phone screenshots | Min 2, max 8. 320–3840 px, long side ≤2× short side. For promotion, ≥4 at ≥1080×1920 | To do: home, plans, booking, My Plan / switch, tickets, profile |
| Privacy policy URL | Live, public page | `<website>/privacy`, naming Mahesh Enterprises and matching §3 |
| Contact details | Email required and public; phone and website optional | e.g. support@<website>, owner's phone, `<website>` |
| Category | — | **House & Home** (alternative: Lifestyle) |
| Countries | — | India only (service is local) |

**Developer account type** [9][10]

| | Personal | Organization (recommended) |
|---|---|---|
| Needs | Owner's ID, $25 fee | **D-U-N-S number for "Mahesh Enterprises"** (free from Dun & Bradstreet; can take weeks), $25 fee, business website and phone |
| Public on Play | Legal name, country, email; full address if monetising | Business name, address, email, phone (matches Razorpay KYC and website) |
| Before production | **Closed test: ≥12 testers × 14 continuous days**, then apply (review ≈7 days) | No closed-test rule (it applies to personal accounts) |

Android developer verification began enforcement in four countries on 30 Sep 2026; global rollout comes later [25]. Play Console accounts verify identity at sign-up. Make sure the package name shows as registered under the account.

---

## 6. Do this next (in order)

| # | Who | Task | Time |
|---|---|---|---|
| 1 | Owner | Choose the account type. If organization, **apply for a D-U-N-S number today** (longest wait). Create the Play Console account | 1 h + wait |
| 2 | Owner | Settle the store name and brand, and confirm the package name and the "SmartRO" trademark | 30 min |
| 3 | Dev | Branch and upgrade to **Expo SDK 54** (option B): `blockedPermissions`, version `1.0.0`, hide dead UI and the photo claim, fix the referral link, retest edge-to-edge and the keyboard on Android 15/16 | 3–5 days |
| 4 | Dev | Finish in-app delete + Firebase `deleteUser`, and handle ticket text (§2) | 0.5 day |
| 5 | Dev + Owner | Publish privacy, terms, refund, delivery, contact and delete-account pages; update `SITE_URL` in `src/utils/legal.ts` to the final domain | in progress |
| 6 | Dev | Build the EAS `production` AAB. Create the app, upload to **internal testing** (`eas submit` needs a Google service-account key [22]). Copy the Play app-signing SHA-1/256 and the EAS upload-key SHA-1/256 into Firebase; enable Play Integrity; upload the FCM V1 key. **Test OTP and push on a Play-installed build** | 0.5 day |
| 7 | Dev | Set up the demo account, the Firebase test number and the App access text (§4) | 1 h |
| 8 | Owner + Dev | Fill in App content: Data safety (§3), deletion URL, rating, audience, ads, financial, health, government, advertising ID | 2–3 h |
| 9 | Owner | Store listing text, icon, feature graphic, screenshots, contact details | 1 day |
| 10 | Owner | Personal account: closed test with ≥12 testers for 14 days, then apply for production (≈7 days). Organization: send to production review | 3 weeks / days |
| 11 | Dev | Before **1 Feb 2027**, confirm the AAB is 16 KB-aligned (SDK 54 should already be) | 15 min |

---

## Sources (checked 3 Nov 2026)
1. Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
2. 16 KB page sizes (Play deadline 1 Feb 2027): https://developer.android.com/guide/practices/page-sizes
3. Expo 16 KB guide: https://github.com/expo/fyi/blob/main/android-16kb-page-sizes.md
4. Expo SDK 54 changelog (API 36, mandatory edge-to-edge, last Legacy Architecture SDK): https://expo.dev/changelog/sdk-54
5. Expo SDK 58 upgrade guide: https://expo.dev/blog/how-to-upgrade-to-sdk-58
6. Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
7. Data safety form guidance: https://support.google.com/googleplay/android-developer/answer/10787469
8. Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
9. Testing requirements for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
10. Developer account types: https://support.google.com/googleplay/android-developer/answer/13628312
11. App access / sign-in details: https://support.google.com/googleplay/android-developer/answer/15748846
12. Graphic assets and screenshots: https://support.google.com/googleplay/android-developer/answer/9866151
13. Financial features declaration: https://support.google.com/googleplay/android-developer/answer/13849271
14. Ads declaration: https://support.google.com/googleplay/android-developer/answer/9859455
15. Target audience and content: https://support.google.com/googleplay/android-developer/answer/9867159
16. Content ratings: https://support.google.com/googleplay/android-developer/answer/188189
17. Health apps declaration: https://support.google.com/googleplay/android-developer/answer/14738291
18. Razorpay data safety: https://razorpay.com/docs/payments/payment-gateway/android-integration/standard/google-data-safety/
19. Firebase Play data disclosure: https://firebase.google.com/docs/android/play-data-disclosure
20. Firebase phone auth (test numbers, SHA, Play Integrity): https://firebase.google.com/docs/auth/android/phone-auth
21. Expo FCM V1 credentials: https://docs.expo.dev/push-notifications/fcm-credentials/
22. EAS Submit for Android: https://docs.expo.dev/submit/android/
23. Expo permissions / `blockedPermissions`: https://docs.expo.dev/guides/permissions/
24. Android local network permission: https://developer.android.com/privacy-and-security/local-network-permission
25. Android developer verification: https://developer.android.com/developer-verification
26. Razorpay `standard-core` manifest (Maven Central): https://repo1.maven.org/maven2/com/razorpay/standard-core/
