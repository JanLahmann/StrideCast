// Remote control: takes commands from the Mac's dev server (server/control.mjs, fed by the
// MCP server in mcp/control.mjs) and carries them out in Chrome: bring a tab to the front,
// play or pause the video, search YouTube, start or stop /tv.
//
// Answers carry no page content: no tab titles or addresses of Teams, Outlook or WhatsApp,
// only what the command did (and YouTube video titles, which are public).
// Loaded by background.js with importScripts.

const CONTROL_NEXT = 'http://127.0.0.1:3700/__control/next';
const CONTROL_RESULT = 'http://127.0.0.1:3700/__control/result';
const CONTROL_HEADERS = { 'X-StrideCast-Control': '1' };

// Tabs by name: the address patterns that count as that tab, and what to open if none is.
const TABS = {
  youtube: { match: ['https://www.youtube.com/*'], open: 'https://www.youtube.com/' },
  music: { match: ['https://music.youtube.com/*'], open: 'https://music.youtube.com/' },
  tv: { match: ['http://127.0.0.1:3700/tv*'], open: 'http://127.0.0.1:3700/tv' },
  whatsapp: { match: ['https://web.whatsapp.com/*'], open: 'https://web.whatsapp.com/' },
  teams: { match: ['https://teams.microsoft.com/*', 'https://teams.cloud.microsoft/*'], open: 'https://teams.cloud.microsoft/' },
  outlook: {
    match: ['https://outlook.office.com/*', 'https://outlook.office365.com/*', 'https://outlook.cloud.microsoft/*', 'https://outlook.live.com/*'],
    open: 'https://outlook.office.com/mail/',
  },
  printer: { match: ['http://prusa-core-one.fritz.box/*', 'http://192.168.178.117/*'], open: 'http://prusa-core-one.fritz.box/' },
  prusa: { match: ['https://connect.prusa3d.com/*'], open: 'https://connect.prusa3d.com/' },
};

async function findTab(name) {
  const spec = TABS[name];
  if (!spec) throw new Error(`unknown tab "${name}"; known: ${Object.keys(TABS).join(', ')}`);
  const tabs = await chrome.tabs.query({ url: spec.match });
  // The one used last, if there are several.
  return tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0] ?? null;
}

async function showTab(name, { open = true } = {}) {
  let tab = await findTab(name);
  let opened = false;
  if (!tab) {
    if (!open) throw new Error(`no ${name} tab is open`);
    tab = await chrome.tabs.create({ url: TABS[name].open, active: true });
    opened = true;
  }
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  return { tab, opened };
}

// The tab a media command goes to: the named one, else the active tab of the focused window.
async function targetTab(name) {
  if (name) return (await showTab(name, { open: false })).tab;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error('no active tab');
  return tab;
}

async function run(tab, func, args = []) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return result?.result;
}

// Runs in the page: acts on the biggest video (the main player, not previews).
function pageMedia(action, value) {
  const videos = [...document.querySelectorAll('video')].filter((v) => v.offsetWidth && v.offsetHeight);
  const video = videos.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
  if (!video) return { error: 'no video on this page' };
  const ytClick = (selector) => {
    const button = document.querySelector(selector);
    if (!button) return false;
    button.click();
    return true;
  };
  switch (action) {
    case 'play': video.play(); break;
    case 'pause': video.pause(); break;
    case 'toggle': if (video.paused) video.play(); else video.pause(); break;
    case 'forward': video.currentTime += value || 10; break;
    case 'back': video.currentTime = Math.max(0, video.currentTime - (value || 10)); break;
    case 'restart': video.currentTime = 0; break;
    case 'volume': video.volume = Math.max(0, Math.min(1, (value ?? 50) / 100)); video.muted = false; break;
    case 'mute': video.muted = true; break;
    case 'unmute': video.muted = false; break;
    case 'next': if (!ytClick('.ytp-next-button')) return { error: 'no next button on this page' }; break;
    default: return { error: `unknown action "${action}"` };
  }
  return {
    paused: video.paused,
    muted: video.muted,
    volume: Math.round(video.volume * 100),
    position: Math.round(video.currentTime),
    duration: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
  };
}

// Runs in the YouTube page: opens the n-th video of the list on screen (search results, home).
function pageYoutubeOpen(n) {
  const links = [...document.querySelectorAll('a#video-title, a#video-title-link, a.yt-lockup-metadata-view-model__title')]
    .filter((a) => a.offsetWidth && a.href.includes('/watch'));
  const link = links[(n || 1) - 1];
  if (!link) return { error: `no video number ${n} on the page (found ${links.length})` };
  const title = (link.getAttribute('title') || link.textContent || '').trim();
  link.click();
  return { opened: n || 1, title };
}

// Runs in /tv: presses one of its buttons.
function pageTv(action) {
  const ids = { start: 'go', stop: 'stop', camera: 'camera', values: 'hideBar' };
  const button = document.getElementById(ids[action]);
  if (!button) return { error: `unknown action "${action}"` };
  button.click();
  return { done: action, cameraShown: !document.getElementById('cam')?.hidden, running: document.getElementById('start')?.hidden ?? null };
}

const commands = {
  async list_tabs() {
    const open = {};
    for (const name of Object.keys(TABS)) {
      const tabs = await chrome.tabs.query({ url: TABS[name].match });
      if (tabs.length) open[name] = tabs.length;
    }
    return { open, closed: Object.keys(TABS).filter((name) => !open[name]) };
  },
  async show_tab({ tab }) {
    const { opened } = await showTab(tab);
    return { shown: tab, opened };
  },
  async media({ action, value, tab }) {
    if (action === 'fullscreen') {
      const target = await targetTab(tab);
      const win = await chrome.windows.get(target.windowId);
      const state = win.state === 'fullscreen' ? 'normal' : 'fullscreen';
      await chrome.windows.update(target.windowId, { state });
      return { window: state };
    }
    const result = await run(await targetTab(tab), pageMedia, [action, value ?? null]);
    if (result?.error) throw new Error(result.error);
    return result;
  },
  async youtube_search({ query }) {
    if (!query) throw new Error('no search words');
    const { tab } = await showTab('youtube');
    await chrome.tabs.update(tab.id, { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` });
    return { searched: query };
  },
  async youtube_open({ n }) {
    const { tab } = await showTab('youtube', { open: false });
    const result = await run(tab, pageYoutubeOpen, [n ?? 1]);
    if (result?.error) throw new Error(result.error);
    return result;
  },
  async tv({ action }) {
    const { tab, opened } = await showTab('tv');
    if (opened) await new Promise((r) => setTimeout(r, 1500));
    const result = await run(tab, pageTv, [action]);
    if (result?.error) throw new Error(result.error);
    return result;
  },
  async overlay({ mode }) {
    const tab = await targetTab();
    await chrome.tabs.sendMessage(tab.id, { type: 'mode', mode });
    return { overlay: mode };
  },
};

// Long-polls the dev server for commands while it runs; quiet and slow when it doesn't.
let polling = false;
async function pollControl() {
  if (polling) return;
  polling = true;
  try {
    for (;;) {
      const res = await fetch(CONTROL_NEXT, { headers: CONTROL_HEADERS, cache: 'no-store', signal: AbortSignal.timeout(30000) });
      if (res.status === 204) continue;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { id, command, args } = await res.json();
      let answer;
      try {
        if (!commands[command]) throw new Error(`unknown command "${command}"`);
        answer = { ok: true, result: await commands[command](args ?? {}) };
      } catch (error) {
        answer = { ok: false, error: String(error?.message ?? error) };
      }
      await fetch(CONTROL_RESULT, {
        method: 'POST',
        headers: { ...CONTROL_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...answer }),
      });
    }
  } catch {
    // dev server not running; the alarm and the overlays' polls start it again
  } finally {
    polling = false;
  }
}
