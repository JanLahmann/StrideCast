// Formatting and route-video math, shared by the pages and the tests.

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

const formats = {
  power: (v) => String(Math.round(v)),
  targetPower: (v) => String(Math.round(v)),
  rpm: (v) => String(Math.round(v)),
  hr: (v) => (v > 0 ? String(Math.round(v)) : '–'),
  speed: (v) => v.toFixed(1),
  distance: (v) => v.toFixed(2),
  energy: (v) => String(Math.round(v)),
  elapsed: formatTime,
};

export function formatValue(key, data) {
  const v = data?.[key];
  if (typeof v !== 'number' || Number.isNaN(v)) return '–';
  return (formats[key] ?? String)(v);
}

// Below this speed the route video pauses.
export const MIN_SPEED = 1;
export const MIN_RATE = 0.25;
export const MAX_RATE = 2;

// Playback rate for a video filmed at filmedSpeed (km/h) while you move at speed (km/h).
// 0 means pause.
export function playbackRate(speed, filmedSpeed) {
  if (!(speed >= MIN_SPEED) || !(filmedSpeed > 0)) return 0;
  const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, speed / filmedSpeed));
  return Math.round(rate * 100) / 100;
}

// YouTube only plays at a few fixed rates; pick the nearest one.
export function snapRate(rate, available) {
  if (!rate || !available?.length) return rate;
  return available.reduce((best, r) => (Math.abs(r - rate) < Math.abs(best - rate) ? r : best));
}

const YOUTUBE_ID = /^[\w-]{11}$/;

// Video id from a YouTube link (watch, youtu.be, embed, shorts, live) or a bare id.
export function youtubeId(input) {
  const text = String(input ?? '').trim();
  if (YOUTUBE_ID.test(text)) return text;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}
