import Toybox.BluetoothLowEnergy;
import Toybox.Lang;
import Toybox.WatchUi;

// Finds the StrideCast bridge (the Pi) by its advertised name, connects, and subscribes to
// its data characteristic. The watch reconnects to a paired device by itself.
class Bridge extends BluetoothLowEnergy.BleDelegate {
    const NAME = "StrideCast";
    const SERVICE = BluetoothLowEnergy.longToUuid(0xf6962b0fc7424432l, 0xb81220fcb854faa7l);
    const DATA = BluetoothLowEnergy.longToUuid(0xf6962b10c7424432l, 0xb81220fcb854faa7l);

    var status as String = "Starting";
    var latest as Dictionary? = null;
    var latestAt as Number = 0; // System.getTimer() of the last packet
    private var _device as BluetoothLowEnergy.Device? = null;

    function initialize() {
        BleDelegate.initialize();
    }

    function start() as Void {
        BluetoothLowEnergy.setDelegate(self);
        BluetoothLowEnergy.registerProfile({
            :uuid => SERVICE,
            :characteristics => [{ :uuid => DATA, :descriptors => [BluetoothLowEnergy.cccdUuid()] }],
        });
    }

    function stop() as Void {
        BluetoothLowEnergy.setScanState(BluetoothLowEnergy.SCAN_STATE_OFF);
        if (_device != null) {
            BluetoothLowEnergy.unpairDevice(_device);
            _device = null;
        }
    }

    function onProfileRegister(uuid as BluetoothLowEnergy.Uuid, status as BluetoothLowEnergy.Status) as Void {
        if (status != BluetoothLowEnergy.STATUS_SUCCESS) {
            setStatus("Profile error " + status);
            return;
        }
        setStatus("Searching");
        BluetoothLowEnergy.setScanState(BluetoothLowEnergy.SCAN_STATE_SCANNING);
    }

    function onScanResults(results as BluetoothLowEnergy.Iterator) as Void {
        for (var r = results.next() as BluetoothLowEnergy.ScanResult?; r != null; r = results.next() as BluetoothLowEnergy.ScanResult?) {
            if (NAME.equals(r.getDeviceName())) {
                BluetoothLowEnergy.setScanState(BluetoothLowEnergy.SCAN_STATE_OFF);
                setStatus("Connecting");
                _device = BluetoothLowEnergy.pairDevice(r);
                return;
            }
        }
    }

    function onConnectedStateChanged(device as BluetoothLowEnergy.Device, state as BluetoothLowEnergy.ConnectionState) as Void {
        if (state != BluetoothLowEnergy.CONNECTION_STATE_CONNECTED) {
            setStatus("Reconnecting");
            return;
        }
        var service = device.getService(SERVICE);
        var data = service != null ? service.getCharacteristic(DATA) : null;
        var cccd = data != null ? data.getDescriptor(BluetoothLowEnergy.cccdUuid()) : null;
        if (cccd == null) {
            setStatus("No StrideCast service");
            return;
        }
        setStatus("Subscribing");
        cccd.requestWrite([0x01, 0x00]b);
    }

    function onDescriptorWrite(descriptor as BluetoothLowEnergy.Descriptor, status as BluetoothLowEnergy.Status) as Void {
        setStatus(status == BluetoothLowEnergy.STATUS_SUCCESS ? "Connected" : "Subscribe error " + status);
    }

    function onCharacteristicChanged(characteristic as BluetoothLowEnergy.Characteristic, value as ByteArray) as Void {
        var decoded = Packet.decode(value);
        if (decoded != null) {
            latest = decoded;
            latestAt = System.getTimer();
            status = "Connected";
        }
    }

    // Values younger than 5 s, else null.
    function current() as Dictionary? {
        return latest != null && System.getTimer() - latestAt < 5000 ? latest : null;
    }

    private function setStatus(text as String) as Void {
        status = text;
        WatchUi.requestUpdate();
    }
}
