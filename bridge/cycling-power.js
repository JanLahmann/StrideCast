// Cycling Power Measurement (Bluetooth characteristic 0x2A63) with crank revolution data, and
// Cycling Speed and Cadence Measurement (0x2A5B) with wheel revolution data.
// Watches and bike computers (Garmin among them) take cadence from the crank data: a running
// count of crank revolutions and the time of the last one, in 1/1024 s. The console only
// reports rpm, so CrankCounter turns rpm into that count.

const CRANK_DATA_PRESENT = 0x20;

// Counts revolutions (crank or wheel) from a rate, the way a sensor magnet would.
class RevolutionCounter {
  constructor(wrap = 0x10000) {
    this.wrap = wrap; // the revolution count field rolls over at this value
    this.revs = 0; // fractional revolutions since start
    this.eventMs = 0; // time of the last whole revolution, ms since start
    this.lastMs = null;
  }

  // perSecond: revolutions per second now; nowMs: time of the reading, ms since start (monotonic).
  update(perSecond, nowMs) {
    if (this.lastMs != null && perSecond > 0) {
      const before = Math.floor(this.revs);
      this.revs += perSecond * ((nowMs - this.lastMs) / 1000);
      const whole = Math.floor(this.revs);
      if (whole > before) {
        // the last whole revolution happened (fraction of a revolution) / (revolutions per ms) ago
        this.eventMs = nowMs - (this.revs - whole) / (perSecond / 1000);
      }
    }
    this.lastMs = nowMs;
    return {
      revs: Math.floor(this.revs) % this.wrap,
      eventTime: Math.round(this.eventMs * 1.024) % 0x10000, // 1/1024 s
    };
  }
}

// Crank revolutions from the console's rpm.
class CrankCounter extends RevolutionCounter {
  update(rpm, nowMs) {
    return super.update(rpm / 60, nowMs);
  }
}

// Wheel circumference the speed sensor pretends to have. Set the same wheel size (2096 mm)
// on the watch, or its speed and distance will be off by the ratio of the two.
const WHEEL_MM = 2096;

// Wheel revolutions from the console's speed in km/h.
class WheelCounter extends RevolutionCounter {
  constructor() {
    super(0x100000000);
  }
  update(kmh, nowMs) {
    return super.update(kmh / 3.6 / (WHEEL_MM / 1000), nowMs);
  }
}

// Cycling Speed and Cadence Measurement (0x2A5B) with wheel revolution data only.
function encodeSpeedMeasurement(wheel) {
  const buf = Buffer.alloc(7);
  buf.writeUInt8(0x01, 0); // wheel revolution data present
  buf.writeUInt32LE(wheel.revs, 1);
  buf.writeUInt16LE(wheel.eventTime, 5);
  return buf;
}

function encodePowerMeasurement(power, crank) {
  const buf = Buffer.alloc(8);
  buf.writeUInt16LE(CRANK_DATA_PRESENT, 0);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(power || 0))), 2);
  buf.writeUInt16LE(crank.revs, 4);
  buf.writeUInt16LE(crank.eventTime, 6);
  return buf;
}

// Running Speed and Cadence Measurement (0x2A53), for watches that take a foot pod in
// treadmill and walking activities. Speed in 1/256 m/s, cadence in steps per minute (two
// steps per crank revolution, one per foot), total distance in 1/10 m.
const TOTAL_DISTANCE_PRESENT = 0x02;

function encodeRunMeasurement(kmh, rpm, distanceDm) {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(TOTAL_DISTANCE_PRESENT, 0);
  buf.writeUInt16LE(Math.min(0xffff, Math.round(((kmh || 0) / 3.6) * 256)), 1);
  buf.writeUInt8(Math.min(255, Math.round((rpm || 0) * 2)), 3);
  buf.writeUInt32LE(Math.round(distanceDm) % 0x100000000, 4);
  return buf;
}

// StrideCast's own data packet (service f6962b0f-…, read by the Garmin app), 18 bytes,
// little-endian. Keep in step with garmin/source/Packet.mc.
//   0 version (1)            1-2 power W (int16)       3 cadence rpm
//   4-5 speed 0.01 km/h      6-9 distance m            10-11 energy kJ
//   12-13 console time s     14 console heart rate     15 flags (bit 0: console connected)
//   16-17 target power W
function encodeStrideCastData(data, distanceM) {
  const buf = Buffer.alloc(18);
  const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(v || 0)));
  buf.writeUInt8(1, 0);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data.power || 0))), 1);
  buf.writeUInt8(clamp(data.rpm, 255), 3);
  buf.writeUInt16LE(clamp((data.speed || 0) * 100, 0xffff), 4);
  buf.writeUInt32LE(clamp(distanceM, 0xffffffff), 6);
  buf.writeUInt16LE(clamp(data.energy, 0xffff), 10);
  buf.writeUInt16LE(clamp(data.elapsed, 0xffff), 12);
  buf.writeUInt8(clamp(data.hr, 255), 14);
  buf.writeUInt8(data.connected === false ? 0 : 1, 15);
  buf.writeUInt16LE(clamp(data.targetPower, 0xffff), 16);
  return buf;
}

module.exports = {
  encodeStrideCastData,
  CrankCounter,
  WheelCounter,
  WHEEL_MM,
  encodePowerMeasurement,
  encodeSpeedMeasurement,
  encodeRunMeasurement,
};
