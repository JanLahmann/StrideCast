// Fetches the current values for the overlays. Content scripts run under the page's origin
// (youtube.com), which the browser keeps from reading local addresses; the extension may.
// Asks the bridge on the Pi first, so the overlay works without anything running on the
// Mac, and falls back to the Mac's dev server (example data).

const FEEDS = [
  'http://stridecast-pi2w.local:3000/api/now',
  'http://127.0.0.1:3700/api/now',
];
const TIMEOUT_MS = 2500;

let preferred = 0; // index of the feed that answered last

async function fetchNow() {
  const order = [preferred, ...FEEDS.keys()].filter((i, pos, all) => all.indexOf(i) === pos);
  let lastError;
  for (const i of order) {
    try {
      const res = await fetch(FEEDS[i], { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      preferred = i;
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'now') return false;
  fetchNow()
    .then((data) => sendResponse({ data }))
    .catch((error) => sendResponse({ error: String(error?.message ?? error) }));
  return true; // answers asynchronously
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
});
