# StrideCast

Cross-trainer workouts on the TV: a Raspberry Pi bridges a Kettler ELYX (USB) to training apps over Bluetooth.

**Status:** early. The console protocol and both bridges below have been tested on a Pi 5. No app has connected over Bluetooth yet, and nothing runs from this repo yet.

## What it does

- A Raspberry Pi reads the Kettler ELYX 5 console over USB once per second.
- It offers the data over Bluetooth LE as a fitness machine (FTMS and Cycling Power), so training apps can use the ELYX like a smart trainer.
- It serves the live values (heart rate, cadence, speed, power, distance, time) on the home network, so any browser can show them:
  - **Training:** a route video (YouTube or your own files) that plays at your speed, with a live stats overlay.
  - **Office:** a small stats strip next to your work (video calls, a terminal) on the TV.

## Hardware

| Part | Notes |
| --- | --- |
| Kettler ELYX 5 | Console USB port with a CP2102 USB-serial chip (`10c4:ea60`), shows up as `/dev/ttyUSB0`, 9600 baud 8N1. The console answers without pedaling. |
| Raspberry Pi | Planned: Pi Zero 2 W (Bluetooth 4.2 LE, 2.4 GHz Wi-Fi). It needs a micro-USB OTG adapter for the console cable. Tested so far on a Pi 5. |
| Display | A browser on the TV (Samsung TV, Fire TV) or a laptop connected to the TV. |

## Console protocol

Send a command followed by `\r\n`. Every answer ends with `\r\n`.

| Command | Answer on the ELYX 5 |
| --- | --- |
| `VE` | `130` |
| `ID` | `SDFX3069` |
| `KI` | `SDHX<TAB>ELYX 5` |
| `CM` | `ACK` |
| `ST` | `HR RPM speed×10 distance×100m targetW energy-kJ mm:ss actualW` (tab-separated) |

Example `ST` answer while pedaling: `105 063 099 000 090 0015 00:29 090` means 105 bpm, 63 rpm, 9.9 km/h, 0 m, 90 W target, 15 kJ, 0:29, 90 W.

## Software

- **Node bridge (planned core):** a port of [gnep88/kettlerUSB2BLE](https://github.com/gnep88/kettlerUSB2BLE) (MIT) to Node 24. It reads the console, advertises "KettlerBLE" (FTMS and Cycling Power, with target power via `PW`), and pushes live values over socket.io on port 3000. It will live in this repo with its MIT notice.
- **Alternative: [qdomyos-zwift](https://github.com/cagnulein/qdomyos-zwift) (QZ, GPL-3.0).** QZ supports Kettler consoles over USB on Linux. The fix that makes it read the ELYX correctly ([#5507](https://github.com/cagnulein/qdomyos-zwift/pull/5507)) was merged on 2026-10-29, so use a nightly or release built after that. Install QZ from upstream; it is not part of this repo.

Only one program can hold `/dev/ttyUSB0` at a time, so run either the bridge or QZ.

## Quick start (QZ, until the bridge is in this repo)

1. Plug the ELYX console into the Pi and check that `/dev/ttyUSB0` appears.
2. Install a QZ Linux build that includes #5507.
3. In `/root/.config/Roberto Viola/qDomyos-Zwift.conf`, set:
   ```ini
   kettler_usb_serialport=/dev/ttyUSB0
   kettler_usb_baudrate=9600
   ```
4. Start it as root without a display:
   ```sh
   QT_QPA_PLATFORM=offscreen ./qdomyos-zwift -no-gui -log
   ```
5. Pair the training app with the Pi over Bluetooth.

## License

Apache-2.0, see [LICENSE](LICENSE). Code included from other projects keeps its own license notice.
