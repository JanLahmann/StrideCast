// Cycling Power Measurement (Bluetooth characteristic 0x2A63) with crank revolution data.
// Watches and bike computers (Garmin among them) take cadence from the crank data: a running
// count of crank revolutions and the time of the last one, in 1/1024 s. The console only
// reports rpm, so CrankCounter turns rpm into that count.

const CRANK_DATA_PRESENT = 0x20;

class CrankCounter {
  constructor() {
    this.revs = 0; // fractional revolutions since start
    this.eventMs = 0; // time of the last whole revolution, ms since start
    this.lastMs = null;
  }

  // rpm: current cadence; nowMs: time of the reading, ms since start (monotonic).
  update(rpm, nowMs) {
    if (this.lastMs != null && rpm > 0) {
      const before = Math.floor(this.revs);
      this.revs += (rpm / 60) * ((nowMs - this.lastMs) / 1000);
      const whole = Math.floor(this.revs);
      if (whole > before) {
        // the last whole revolution happened (fraction of a revolution) / (revolutions per ms) ago
        this.eventMs = nowMs - (this.revs - whole) / (rpm / 60000);
      }
    }
    this.lastMs = nowMs;
    return {
      revs: Math.floor(this.revs) % 0x10000,
      eventTime: Math.round(this.eventMs * 1.024) % 0x10000,
    };
  }
}

function encodePowerMeasurement(power, crank) {
  const buf = Buffer.alloc(8);
  buf.writeUInt16LE(CRANK_DATA_PRESENT, 0);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(power || 0))), 2);
  buf.writeUInt16LE(crank.revs, 4);
  buf.writeUInt16LE(crank.eventTime, 6);
  return buf;
}

module.exports = { CrankCounter, encodePowerMeasurement };
