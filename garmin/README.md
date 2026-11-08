# StrideCast for Garmin watches

A Connect IQ watch app (fenix 8 family) that reads the bridge's StrideCast service over
Bluetooth, shows power, cadence, speed, distance, time and wrist heart rate, and records a
cross-trainer (elliptical) workout. Power and cadence go into the FIT file with their native
field numbers (record 7 and 4); ELYX speed, distance and energy are developer fields.

## Build

Connect IQ SDK 9.2.0 (SDK Manager). Signed with the developer key of CleanJibe, read from
`~/GitHub/WingFoil/garmin/developer_key.der` (never copied into this repo).

```sh
SDK="$HOME/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-9.2.0-2026-06-09-92a1605b2/bin"
cd garmin
"$SDK/monkeyc" -f monkey.jungle -d fenix847mm -y ~/GitHub/WingFoil/garmin/developer_key.der -o bin/StrideCast-fenix847mm.prg   # one watch
"$SDK/monkeyc" -e -r -f monkey.jungle -y ~/GitHub/WingFoil/garmin/developer_key.der -o bin/StrideCast-<version>.iq            # store package
```

Jan's watch is a fenix 8 AMOLED 51 mm, device id `fenix847mm`.

## Store

Private beta listing **StrideCast (Beta)**, app id `93e2e527-9e0d-4b93-8d37-dabaacf00ce3`,
store page https://apps.garmin.com/apps/d54044e0-cad1-4830-b45a-7a7b6d6f44ae. "App pending"
by design: only Jan's account can install it (Connect IQ app on the phone). A new version:
raise `version` in `manifest.xml`, build the `.iq`, then *Upload New Version* on the store page.
Going public needs a new app id and Jan's own word.

## The bridge side

`bridge/ble/stridecast-service.js`, service `f6962b0f-c742-4432-b812-20fcb854faa7`, one
characteristic (`…2b10…`) with an 18-byte packet, see `encodeStrideCastData` in
`bridge/cycling-power.js` and `source/Packet.mc`. The Pi runs it with
`STRIDECAST_SENSORS=run,ftms,app`.
