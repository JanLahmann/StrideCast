// Sound output for a page: a <select> of the computer's outputs (e.g. the TV over HDMI), so
// StrideCast's sound can go to the TV while everything else stays on the Mac's default.
// The choice is kept by name and applied again on every page load.

const KEY = 'stridecast-output';

function saved() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

function remember(label) {
  try { label ? localStorage.setItem(KEY, label) : localStorage.removeItem(KEY); } catch {}
}

// select: the <select> to fill; media: function returning the elements to route.
export async function setupOutput(select, media) {
  if (!('setSinkId' in HTMLMediaElement.prototype)) {
    select.hidden = true;
    return;
  }
  async function apply(deviceId) {
    for (const el of media()) await el.setSinkId(deviceId).catch(() => {});
  }
  async function fill() {
    const outputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default');
    const options = [new Option('Sound: Mac default', '')];
    for (const d of outputs) options.push(new Option(`Sound: ${d.label || 'Output'}`, d.deviceId));
    select.replaceChildren(...options);
    const pick = outputs.find((d) => d.label === saved());
    select.value = pick ? pick.deviceId : '';
    await apply(select.value);
  }
  select.addEventListener('change', async () => {
    remember(select.value ? select.selectedOptions[0].text.replace(/^Sound: /, '') : null);
    await apply(select.value);
  });
  navigator.mediaDevices.addEventListener('devicechange', fill);
  await fill();
  return { refresh: fill, apply: () => apply(select.value) };
}
