// StrideCast (Apache-2.0): our own service with every console value in one notification,
// for the StrideCast Garmin app. Not a Bluetooth standard, so no app but ours uses it.
const Bleno = require('@abandonware/bleno');
const { encodeStrideCastData } = require('../cycling-power');

const SERVICE_UUID = 'f6962b0fc7424432b81220fcb854faa7';
const DATA_UUID = 'f6962b10c7424432b81220fcb854faa7';

class DataCharacteristic extends Bleno.Characteristic {
  constructor() {
    super({
      uuid: DATA_UUID,
      properties: ['read', 'notify'],
      descriptors: [new Bleno.Descriptor({ uuid: '2901', value: 'StrideCast data' })],
    });
    this._updateValueCallback = null;
    this._last = Buffer.alloc(18);
    this.distanceM = 0; // integrated from the speed, finer than the console's 100 m steps
    this._lastMs = null;
  }

  onReadRequest(_offset, callback) {
    callback(this.RESULT_SUCCESS, this._last);
  }

  onSubscribe(_maxValueSize, updateValueCallback) {
    console.log('[StrideCast app] client subscribed');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    this._updateValueCallback = null;
  }

  notify(event) {
    const nowMs = performance.now();
    if (this._lastMs != null) this.distanceM += ((event.speed || 0) / 3.6) * ((nowMs - this._lastMs) / 1000);
    this._lastMs = nowMs;
    this._last = encodeStrideCastData(event, this.distanceM);
    this._updateValueCallback?.(this._last);
  }
}

class StrideCastService extends Bleno.PrimaryService {
  constructor() {
    const data = new DataCharacteristic();
    super({ uuid: SERVICE_UUID, characteristics: [data] });
    this.data = data;
  }

  notify(event) {
    this.data.notify(event);
  }
}

module.exports = StrideCastService;
