# StrideCast bridge

Runs on the Raspberry Pi at the trainer. It reads the Kettler console over USB once per second and passes the values on:

- **Bluetooth LE** as "StrideCast", with the Fitness Machine (FTMS) and Cycling Power services, so training apps can use the trainer. Apps can set the target power (console command `PW`).
- **HTTP** on port 3000: `GET /api/now` (latest values as JSON) and `GET /api/live` (the same once per second as server-sent events). While the console is off or unplugged, both answer `{"connected": false}`.
- **The pages** from `web/`, on port 3000 and on port 80, with the dashboard as start page: `http://<pi>/` is all a browser on the TV needs.

The bridge finds the console by its USB-serial chip (CP2102, `10c4:ea60`) and reconnects by itself.

## Install on the Pi

Needs Node.js 24 in `/opt/node24` and the user `rasqberry` (change `User=` and the paths in the service file for another user).

```sh
rsync -a --exclude node_modules bridge/ rasqberry@StrideCast-Pi2w.local:stridecast/bridge/
rsync -a --delete web/ rasqberry@StrideCast-Pi2w.local:stridecast/web/
ssh rasqberry@StrideCast-Pi2w.local
cd ~/stridecast/bridge && PATH=/opt/node24/bin:$PATH npm ci --omit=dev
sudo systemctl disable --now bluetooth      # the bridge drives the Bluetooth controller itself
sudo cp stridecast-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now stridecast-bridge
journalctl -u stridecast-bridge -f
```

After changing pages under `web/`, copy them again with the second `rsync`; no restart is needed.

To work on the pages with live reload and the real values, start the dev server on the Mac with the bridge as source:

```sh
npm run dev:pi    # STRIDECAST_SOURCE=http://StrideCast-Pi2w.local:3000
```

## Origin

The files in `ble/` come from [gnep88/kettlerUSB2BLE](https://github.com/gnep88/kettlerUSB2BLE) (MIT, © 2018 360manu, see `LICENSE-kettlerUSB2BLE`), ported to Node 24 and `@abandonware/bleno`; the advertised name is changed to "StrideCast". `server.js`, `console.js` and `parse.js` are new (Apache-2.0) and replace the original Express, socket.io and serial code.
