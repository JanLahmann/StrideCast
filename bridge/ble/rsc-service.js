// StrideCast (Apache-2.0): Running Speed and Cadence service (0x1814), a foot pod for
// watches: speed, cadence (steps) and total distance from the console.
const Bleno = require('@abandonware/bleno');
const { encodeRunMeasurement } = require('../cycling-power');
const StaticReadCharacteristic = require('./static-read-characteristic');

class RunMeasurementCharacteristic extends Bleno.Characteristic {
  constructor() {
    super({
      uuid: '2A53',
      properties: ['notify'],
      descriptors: [new Bleno.Descriptor({ uuid: '2901', value: 'RSC Measurement' })],
    });
    this._updateValueCallback = null;
    this.distanceDm = 0; // total distance in 1/10 m, integrated from the speed
    this._lastMs = null;
  }

  onSubscribe(_maxValueSize, updateValueCallback) {
    console.log('[StrideCast run] client subscribed');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    this._updateValueCallback = null;
  }

  notify(event) {
    if (!('speed' in event)) return;
    const nowMs = performance.now();
    if (this._lastMs != null) this.distanceDm += ((event.speed || 0) / 3.6) * ((nowMs - this._lastMs) / 1000) * 10;
    this._lastMs = nowMs;
    this._updateValueCallback?.(encodeRunMeasurement(event.speed, event.rpm, this.distanceDm));
  }
}

// SC Control Point (0x2A55): required when total distance is supported.
class ControlPointCharacteristic extends Bleno.Characteristic {
  constructor(measurement) {
    super({ uuid: '2A55', properties: ['write', 'indicate'] });
    this._measurement = measurement;
    this._indicate = null;
  }

  onSubscribe(_maxValueSize, updateValueCallback) {
    this._indicate = updateValueCallback;
  }

  onUnsubscribe() {
    this._indicate = null;
  }

  onWriteRequest(data, _offset, _withoutResponse, callback) {
    const opcode = data.readUInt8(0);
    console.log(`[StrideCast run] control point ${data.toString('hex')}`);
    let answer;
    if (opcode === 0x01 && data.length >= 5) {
      this._measurement.distanceDm = data.readUInt32LE(1); // Set Cumulative Value
      answer = [0x10, opcode, 0x01];
    } else if (opcode === 0x04) {
      answer = [0x10, opcode, 0x01, 7]; // supported sensor locations: in shoe
    } else {
      answer = [0x10, opcode, 0x02];
    }
    callback(this.RESULT_SUCCESS);
    this._indicate?.(Buffer.from(answer));
  }
}

class RunningSpeedService extends Bleno.PrimaryService {
  constructor() {
    const measurement = new RunMeasurementCharacteristic();
    super({
      uuid: '1814',
      characteristics: [
        measurement,
        new ControlPointCharacteristic(measurement),
        new StaticReadCharacteristic('2A54', 'RSC Feature', [0x02, 0x00]), // total distance
        new StaticReadCharacteristic('2A5D', 'Sensor Location', [7]), // 7 = in shoe
      ],
    });
    this.measurement = measurement;
  }

  notify(event) {
    this.measurement.notify(event);
  }
}

module.exports = RunningSpeedService;
