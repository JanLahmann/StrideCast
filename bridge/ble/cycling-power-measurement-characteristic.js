
var Bleno = require('@abandonware/bleno');
var DEBUG = false;
const { CrankCounter, encodePowerMeasurement } = require('../cycling-power');

// Spec
//https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.cycling_power_measurement.xml

class CyclingPowerMeasurementCharacteristic extends  Bleno.Characteristic {
 
  constructor() {
    super({
      uuid: '2A63',
      value: null,
      properties: ['notify'],
      descriptors: [
        new Bleno.Descriptor({
					uuid: '2901',
					value: 'Cycling Power Measurement'
				}),
        new Bleno.Descriptor({
          // Client Characteristic Configuration
          uuid: '2902',
          value: Buffer.alloc(2)
        }),
        new Bleno.Descriptor({
          // Server Characteristic Configuration
          uuid: '2903',
          value: Buffer.alloc(2)
        })
      ]
    });
    this._updateValueCallback = null;  
    this._crank = new CrankCounter();
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    if (DEBUG) console.log('[CyclingPowerMeasurementCharacteristic] client subscribed to PM');
    this._updateValueCallback = updateValueCallback;
    return this.RESULT_SUCCESS;
  };

  onUnsubscribe() {
    if (DEBUG) console.log('[CyclingPowerMeasurementCharacteristic] client unsubscribed from PM');
    this._updateValueCallback = null;
    return this.RESULT_UNLIKELY_ERROR;
  };

  // StrideCast: sends crank revolution data so watches show cadence (the original wrote rpm
  // where the crank count belongs, with the flags saying no crank data).
  notify(event) {
    if (!('power' in event) && !('rpm' in event)) {
      // ignore events with no power and no crank data
      return this.RESULT_SUCCESS;
    }
    const crank = this._crank.update(event.rpm || 0, performance.now());
    if (this._updateValueCallback) {
      this._updateValueCallback(encodePowerMeasurement(event.power, crank));
    }
    return this.RESULT_SUCCESS;
  }
};

module.exports = CyclingPowerMeasurementCharacteristic;
