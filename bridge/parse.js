// Parses the Kettler console's answer to ST: eight tab-separated fields,
// "HR RPM speed×10 distance×100m targetW energy-kJ mm:ss actualW".
// Returns the values in the shape of /api/now, or null for any other line.

function parseStatus(line) {
  const fields = String(line).trim().split('\t').map((s) => s.trim());
  if (fields.length !== 8) return null;
  const int = (s) => (/^\d+$/.test(s) ? Number(s) : NaN);
  const [hr, rpm, speed10, distance100m, target, energy, time, power] = fields;
  const clock = /^(\d+):(\d{2})$/.exec(time);
  const data = {
    hr: int(hr),
    rpm: int(rpm),
    speed: int(speed10) / 10,
    distance: int(distance100m) / 10,
    targetPower: int(target),
    energy: int(energy),
    elapsed: clock ? Number(clock[1]) * 60 + Number(clock[2]) : NaN,
    power: int(power),
  };
  return Object.values(data).some(Number.isNaN) ? null : data;
}

module.exports = { parseStatus };
