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

class CyclingSpeedService extends Bleno.PrimaryService {
  constructor() {
    const measurement = new SpeedMeasurementCharacteristic();
    super({
      uuid: '1816',
      characteristics: [
        measurement,
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
