# SmartRO valve firmware (ESP32)

Runs on the ESP32 inside each purifier. It:

1. Joins the home Wi-Fi. The customer sets it up from their phone through a setup hotspot.
2. Asks the SmartRO server whether the plan is paid (`GET /devices/:serial/state`).
   It saves the answer, so water keeps flowing without internet until the plan's end date.
3. Lets the SmartRO app on the same Wi-Fi turn the water on and off.
   **OFF always works. ON only works while the plan is paid.** The ESP32 enforces this, not the app.

Protocol details (server endpoints, local API, signatures):
[../../Android_SmartRO_Backend/docs/esp32-integration.md](../../Android_SmartRO_Backend/docs/esp32-integration.md).

## Wiring

| Relay module | ESP32 |
|---|---|
| DC+ (VCC) | VIN |
| DC– (GND) | GND |
| IN | D26 |

The valve's red (+) wire goes through relay **COM** and **NO**, never NC. That way water stops whenever the ESP32 is off or crashes.

If `relay_test` showed the relay is ON when IN is LOW, set `RELAY_ACTIVE_LOW=1` in `platformio.ini`.

## Builds

| Env | Server | Use |
|---|---|---|
| `lan` (default) | `http://192.168.1.10:4000/api/v1`, the backend on your PC | testing on your own Wi-Fi |
| `production` | `https://srv2122898.hstgr.cloud/api/v1` | purifiers going to customers |

The server address is fixed when you build. It can't be changed from the setup page, so nobody can point a purifier at a fake server. The production build only trusts Let's Encrypt root certificates ([src/certs.h](src/certs.h)).

Before testing, check your PC's address with `ipconfig` ("IPv4 Address" under Wi-Fi). If it isn't `192.168.1.10`, edit `API_BASE` in `[env:lan]`.

## Test on your Wi-Fi (PC + ESP32 + app on the same network)

1. **Let the ESP32 reach your PC.** Windows blocks Node on networks marked *Public*.
   Settings → Network & internet → Wi-Fi → your network → Network profile type → **Private**.
2. **Restart the backend** so it picks up the new routes: in `Android_SmartRO_Backend` press Ctrl+C, then run `npm run dev`.
   Check from your phone's browser that `http://192.168.1.10:4000/health` opens.
3. **Flash the ESP32.** Plug in the bare board. In the PlatformIO sidebar, open smartro_valve → env:lan → **Upload**, then **Monitor**.
4. **Set the identity.** Type these into the monitor. The values are the seeded test purifier with an active plan:
   ```
   serial SR-AP-000101
   token devtok-demo-priya-aquapure-7l
   reboot
   ```
5. **Connect it to Wi-Fi.** On your phone, join the Wi-Fi network `SmartRO-Setup-xxxxxx`. The setup page opens by itself; if it doesn't, open `http://192.168.4.1`.
   Pick your home Wi-Fi, type the password and tap Connect. The ESP32 needs a **2.4 GHz** network.
6. **Watch the monitor.** You should see:
   ```
   [wifi] connected to "...", IP 192.168.1.x
   [cloud] plan ACTIVE, allowFlow=true, until 2027-04-01T13:26:17Z, next check in 3600 s
   [valve] OPEN  -> water flows
   [cloud] heartbeat sent (IP 192.168.1.x)
   ```
7. **Use the app.** In `Android_SmartRO_Frontend`, run `npm run web` and log in as Priya: `+919876543210`, using the dev OTP.
   Then go to My Plan → Smart health → Water switch → **Turn water off**. The relay clicks and the monitor shows `[app] water switched OFF from the app`.

To check that the payment rule holds: suspend Priya's subscription in the admin. The valve closes at the next check, so within about an hour, and the app's ON button shows "Recharge". To see it at once, type `reboot` in the monitor.

The `next check in` time comes from the server: hourly while a plan has more than 3 days left, faster near the end and right after it ends (every minute for the first day). The full schedule is in the [integration doc](../../Android_SmartRO_Backend/docs/esp32-integration.md#how-often-the-purifier-checks).

**Tip:** to make a purifier check the server right now, unplug its power for a few seconds and plug it back in. It checks as soon as it's back on Wi-Fi. Use this right after installation or allocation, or to pick up a recharge or an admin change without waiting for the next check.

A phone needs a new EAS build: the `lan` profile in `eas.json` still points at `192.168.1.21`, and only a new build includes the cleartext/local-network permissions.

## Lights and button

| Blue LED | Meaning |
|---|---|
| steady on | water on |
| off | water off |
| short flash every second | looking for Wi-Fi |
| slow blink | setup hotspot is open |

Hold **BOOT** for 5 seconds to open the setup hotspot. With a working Wi-Fi already saved, the hotspot closes after 10 minutes if nobody finishes setup, and the purifier goes back to the saved Wi-Fi.

A new Wi-Fi that fails to connect within 45 s reopens setup, with the error shown on the page. A Wi-Fi that has worked before is never dropped automatically: after a power cut the router can take minutes to come back.

## Serial monitor commands (115200 baud)

```
status              everything: Wi-Fi, IP, plan, time, valve
serial <SERIAL>     set the serial               token <TOKEN>   set the token
ssid <name>         set the Wi-Fi name           pass <password>  set the Wi-Fi password
setup               open the setup hotspot       wifi-forget      delete the saved Wi-Fi
on | off            the water switch (ON still needs a paid plan)
reboot              apply serial/token/Wi-Fi changes
factory-reset yes   wipe everything
```

The token for a real purifier comes from admin: shown once after Dispatch → Allocate, and later from the Devices page → Token.

## Rules the firmware follows

- The valve stays closed at boot until the plan is known.
- Offline, it uses the saved answer until `expiresAt + graceDays`. If the time is unknown (power cut and no internet since), the valve stays closed.
- It closes the valve by itself at `expiresAt + graceDays`, with or without internet. Server checks only bring news (a recharge, or admin stopping a plan), so they can be hourly. The wait comes from `pollIntervalSec`, kept between 30 s and 1 hour (5 minutes if it's missing). The heartbeat goes every 30 minutes.
- The clock comes from the server's `serverTime` and NTP. It never goes back past the last known time, so a faked NTP answer can't stretch a plan.
- Only our server's own JSON answer cuts the water for a wrong token or serial (401 "device token" / 404 "Device not found"). Hosting error pages and timeouts keep the saved plan. While the API is down, the proxy in front of it answers with its own error pages, and that must not shut off every purifier.
- The app's commands need a one-time code plus a signature made with the purifier's local key. The server gives that key only to the purifier's owner. Other people on the same Wi-Fi can read the status but can't switch the water.

## Not done yet

- DS3231 clock module support. Without it, water stays off after a power cut until the internet is back.
- Updates over Wi-Fi (OTA). The flash layout (`min_spiffs.csv`) already has room for them.
