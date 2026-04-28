# SmartRO — Customer Mobile App

React Native + Expo (SDK 51), TypeScript. Runs on iOS, Android, and the web (preview).

## Quick start

```bash
cd Android_SmartRO_Frontend
npm install            # ~2 min first time
npm start              # opens Expo dev tools, scan QR with Expo Go on your phone
# or
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run web            # browser preview (limited but renders most screens)
```

**Backend must be running first** — see `../Android_SmartRO_Backend/README.md`.

## Demo login

OTP login. The backend returns the OTP in the response body in dev mode (so you don't need an SMS provider).

| Phone | Account |
|---|---|
| `+919876543210` | Priya — has active subscription, KYC verified |
| `+919812345678` | Rahul — booking pending KYC |
| `+919800000001` | Aditi — inquiry only |

You can also enter any new phone number; a customer is created on first OTP verification.

## API base URL

By default the app connects to `http://localhost:4000/api/v1`.

- iOS simulator + web: `localhost` works.
- Android emulator: auto-rewritten to `10.0.2.2`.
- Physical device with Expo Go: edit `app.json` → `extra.apiBaseUrl` to your Mac's LAN IP, e.g. `http://192.168.1.42:4000/api/v1`. Find it with `ipconfig getifaddr en0`.

## Screens

| Stack | Screen |
|---|---|
| Auth | Phone, OTP |
| Tabs | Home, My Plan, Tickets, Profile |
| Catalog | Catalog, Product Detail |
| Booking | Booking (KYC → Sign → Pay → Done) |
| Tickets | New Ticket |

## Notes

- Auth is OTP-based (matches the doc spec). No SMS provider in prototype — OTP is returned by the backend.
- Payment is a stub — backend simulates a 1.5s gateway round-trip and auto-marks success.
- KYC submission goes into a "pending" admin queue (matches doc).
- All money values come from the backend in **paise** and are rendered in INR.
