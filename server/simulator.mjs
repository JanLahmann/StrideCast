// Example data in the shape the bridge will send, so the pages work without the ELYX.
// Units: power and targetPower in W, rpm, speed in km/h, hr in bpm, distance in km,
// energy in kJ, elapsed in s.

export function createSimulator() {
  let elapsed = 0;
  let distance = 0;
  let energy = 0;
  let last;

  function sample() {
    const t = elapsed;
    const power = Math.round(90 + 12 * Math.sin(t / 40) + 4 * Math.sin(t / 7));
    const rpm = Math.round(63 + 4 * Math.sin(t / 40 + 0.5) + 2 * Math.sin(t / 9));
    // The ELYX 5 console reports about 9.9 km/h at 63 rpm.
    const speed = Math.round(rpm * 1.57) / 10;
    const hr = Math.round(120 - 40 * Math.exp(-t / 300) + 3 * Math.sin(t / 50));
    return { power, targetPower: 90, rpm, speed, hr };
  }

  return {
    tick(seconds = 1) {
      elapsed += seconds;
      last = sample();
      distance += (last.speed * seconds) / 3600;
      energy += (last.power * seconds) / 1000;
      return this.current();
    },
    current() {
      last ??= sample();
      return {
        ...last,
        distance: Math.round(distance * 100) / 100,
        energy: Math.round(energy),
        elapsed,
        source: 'example',
      };
    },
  };
}
