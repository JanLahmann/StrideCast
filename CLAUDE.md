# StrideCast: notes for Claude

## Project

- A Raspberry Pi reads a Kettler ELYX 5 cross trainer over USB, offers it over Bluetooth LE (FTMS, Cycling Power), and serves live stats to a browser on the TV.
- Not a Fun-with-Quantum family member: no family footer, no Umami, no family links unless Jan says so.
- Background notes, patches and build scripts: `~/GitHub/FwQ-Coordinator/docs/projects/elyx-kettler/`.
- The qz logs in `~/GitHub/RasQberry-Two/.local/elyx-kettler/` contain heart-rate data. Never commit or copy them anywhere.

## Code

- `web/`: the pages (plain HTML, CSS and ES modules, no build step). `web/assets/stats.js` holds the pure functions; keep them testable in Node.
- `server/dev.mjs`: dev server with example data (`server/simulator.mjs`) and live reload. It binds to 127.0.0.1 only; keep it that way.
- `extension/`: Chrome extension (Manifest V3) with the overlay on YouTube, YouTube Music and Teams recordings (sharepoint.com, Teams web). Its service worker fetches `/api/now`; the content script draws the bar and panel in a shadow root. `extension/lib/stats.js` is a copy of `web/assets/stats.js`, kept identical by a test.
- `bridge/`: runs on the Pi Zero 2 W `StrideCast-Pi2w.local` (user `rasqberry`, service `stridecast-bridge`, port 3000). CommonJS; `ble/` is vendored MIT code from kettlerUSB2BLE. Deploy with rsync + `npm ci` on the Pi (native builds need the `allowScripts` entries; the Zero needs extra swap to compile). See `bridge/README.md`.
- `npm run dev:pi`: the dev server takes the values from the bridge instead of the simulator.
- `test/`: `npm test` (`node --test`). The root package has no npm dependencies.
- Live data shape (`/api/live`, server-sent events): `power`, `targetPower` (W), `rpm`, `speed` (km/h), `hr` (bpm), `distance` (km), `energy` (kJ), `elapsed` (s), `source` (`example` or the device).
- Jan views the pages in the Claude desktop app's browser panel at `http://127.0.0.1:3700/`; they reload themselves on every change.

## Licensing

- This repo is Apache-2.0.
- Never copy GPL code from qdomyos-zwift (QZ) into this repo. Reference upstream and install it instead.
- MIT code (e.g. gnep88/kettlerUSB2BLE) may be included, with its license notice kept.

## Devices

- `rasq-pi5` is the RasQberry rig Pi and is shared. Check with the RasQberry session before using it, and leave it as you found it.
- No credentials on any device.

## Commits and PRs

- Branch from `main`, open a PR, merge after green checks with `gh pr merge --squash --delete-branch`.
- No force-push; use follow-up commits.
- Commits end with the `Co-Authored-By: Claude …` line and the session line; PR bodies end with the "Generated with Claude Code" line and the session URL.

## Needs Jan's own word

- Going public with anything new (site, domain, app store, TV app store).
- Privacy or legal text.
- Secrets, costs, budgets.
- Deleting content.
- Contacting outside projects. Jan submits upstream PRs and issues himself; draft them for him.

## Other

- Never enter passwords or create accounts; Jan logs in himself. Never ask for tokens in chat. Secrets go in `~/.config/<name>/` (mode 600) and are used without printing.
- `~/ClaudeLogs` is private: never commit, copy or send it.
- American spelling in new texts. Compute every number you state.
