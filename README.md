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

## The pages on the TV

The bridge on the Pi serves the pages too, on port 80 as well as 3000: open `http://<pi name>/` (e.g. `http://stridecast-pi2w/` on a Fritz!Box network) in any browser on the home network, e.g. the TV's, and it shows the dashboard. Nothing has to run on a computer. Older browsers without JavaScript modules (like the one in some Samsung displays) get a simpler script that polls the values.

## Fire TV on the Mac (capture card)

`/tv` shows an HDMI source through a USB capture card (tested with a MiraBox HSV321 and a Fire TV stick) with the live values on top. Chrome asks once for camera and microphone: that is the card's picture and sound.

- **P** picture in picture (the TV picture floats above other windows), **F** full screen, **Alt+S** shows or hides the values (as on YouTube), **X** stops the capture card (picture and sound off; Start opens it again).
- **Sound:** pick the output at the bottom left (e.g. the TV over HDMI); everything else on the Mac keeps its default. The page remembers the choice.
- No sound? The card takes stereo PCM only. On the Fire TV set Settings → Display & Sounds → Audio → Surround Sound to **PCM**, then unplug the card's USB cable once and reload the page.
- Copy-protected apps (Netflix, Prime Video) stay black through a capture card.

## Try the pages (example data)

The web pages run on any computer with Node.js 20 or newer, without the ELYX:

```sh
npm run dev    # http://127.0.0.1:3700/
npm test
```

- **Ride:** a route video (a file on your computer or a YouTube link) that plays at your speed, with live stats.
- **Dashboard:** big numbers and the last 10 minutes.

The dev server sends example data once per second, reloads open pages when a file under `web/` changes, and only accepts connections from the same computer.

## Stats on YouTube (Chrome extension)

The extension in `extension/` shows your live values on top of youtube.com, music.youtube.com, Teams recordings (Teams web and the SharePoint/Stream player) and WhatsApp Web, also in full screen. It reads them straight from the bridge on the Pi (`http://stridecast-pi2w.local:3000`), so nothing has to run on the Mac. If the Pi is off, it falls back to the dev server above (`npm run dev`, example data).

1. Open `chrome://extensions`, turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose the `extension` folder of this repo.
3. Open YouTube. The stats bar appears at the top right.

- The overlay appears only while the ELYX is in use (cadence or power above zero) and hides itself 2 minutes after you stop. Alt+S shows it for 2 minutes anyway. Hiding it with × lasts until your next workout.
- **Alt+S** or the StrideCast toolbar icon switches between the small bar, a larger panel with a 10-minute chart, and hidden.
- **Sound:** the panel's header picks the output for the video (e.g. the TV over HDMI); the rest of the Mac keeps its default. The first time, choose "Choose output…": Chrome asks once for the microphone on that site, which it needs to show the output names (the microphone is closed right away). The choice is remembered for all sites.
- Drag the bar or the panel's title to move them; drag the panel's corner to resize it. Both are remembered.
- After changing the extension's files, click the reload icon on its card in `chrome://extensions`, then reload the YouTube tab.

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
