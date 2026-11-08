// StrideCast (Apache-2.0): Cycling Speed and Cadence service (0x1816) with wheel data only,
// so watches get speed and distance from the console's speed.
const Bleno = require('@abandonware/bleno');
const { WheelCounter, encodeSpeedMeasurement } = require('../cycling-power');
const StaticReadCharacteristic = require('./static-read-characteristic');

class SpeedMeasurementCharacteristic extends Bleno.Characteristic {
  constructor() {
    super({
      uuid: '2A5B',
      properties: ['notify'],
      descriptors: [new Bleno.Descriptor({ uuid: '2901', value: 'CSC Measurement' })],
    });
    this._updateValueCallback = null;
    this._wheel = new WheelCounter();
  }

  onSubscribe(_maxValueSize, updateValueCallback) {
    console.log('[StrideCast speed] client subscribed');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    this._updateValueCallback = null;
  }

  notify(event) {
    if (!('speed' in event)) return;
    const wheel = this._wheel.update(event.speed || 0, performance.now());
    this._updateValueCallback?.(encodeSpeedMeasurement(wheel));
  }
}

// SC Control Point (0x2A55): required when wheel data is supported. Answers by indication:
// 0x10, the request's opcode, then 0x01 success / 0x02 not supported.
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
    console.log(`[StrideCast speed] control point ${data.toString('hex')}`);
    let answer;
    if (opcode === 0x01 && data.length >= 5) {
      // Set Cumulative Value: start counting wheel revolutions from the given value
      this._measurement._wheel.revs = data.readUInt32LE(1);
      answer = [0x10, opcode, 0x01];
    } else if (opcode === 0x04) {
      // Request Supported Sensor Locations: only the rear wheel
      answer = [0x10, opcode, 0x01, 12];
    } else {
      answer = [0x10, opcode, 0x02];
    }
    callback(this.RESULT_SUCCESS);
    this._indicate?.(Buffer.from(answer));
  }
}

class CyclingSpeedService extends Bleno.PrimaryService {
  constructor() {
    const measurement = new SpeedMeasurementCharacteristic();
    super({
      uuid: '1816',
      characteristics: [
        measurement,
        new ControlPointCharacteristic(measurement),
        new StaticReadCharacteristic('2A5C', 'CSC Feature', [0x01, 0x00]), // wheel revolution data
        new StaticReadCharacteristic('2A5D', 'Sensor Location', [12]), // 12 = rear wheel
      ],
    });
    this.measurement = measurement;
  }

  notify(event) {
    this.measurement.notify(event);
  }
}

module.exports = CyclingSpeedService;
