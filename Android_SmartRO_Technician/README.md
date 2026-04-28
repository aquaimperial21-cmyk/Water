# SmartRO — Technician App

Field-service mobile app. React Native + Expo (SDK 51), TypeScript. iOS + Android.

## Quick start

```bash
cd Android_SmartRO_Technician
npm install
npm start         # then scan QR with Expo Go, or
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # browser preview
```

**Backend must be running** (see `../Android_SmartRO_Backend/README.md`).

## Demo logins

| Email | Password | Zone |
|---|---|---|
| `tech1@smartro.in` | `Tech@12345` | Pune-East — has a job scheduled today |
| `tech2@smartro.in` | `Tech@12345` | Mumbai-West |

## Screens

- Login (email + password)
- Today's jobs / All jobs (toggle)
- Job detail (call customer, checklist, field notes, status transitions: SCHEDULED → EN_ROUTE → IN_PROGRESS → DONE)
- Profile (employee code, zone, sign out)

## Notes

- Updating job to `IN_PROGRESS` flips the linked ticket to `IN_PROGRESS`; marking `DONE` resolves the ticket.
- Customer call uses the device dialer via `tel:` URL.
- Photo capture / signature capture / QR scanning are described in checklists but not yet implemented (would require `expo-camera`, `expo-barcode-scanner`, `react-native-signature-canvas` — Phase 2).
