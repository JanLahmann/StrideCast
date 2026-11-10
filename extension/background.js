// Fetches the current values for the overlays. Content scripts run under the page's origin
// (youtube.com), which the browser keeps from reading local addresses; the extension may.
// Asks the bridge on the Pi first, so the overlay works without anything running on the
// Mac, and falls back to the Mac's dev server (example data).

const FEEDS = [
  'http://stridecast-pi2w.local:3000/api/now',
  // Chrome doesn't always resolve .local names; the Pi's fixed address on Jan's network.
  'http://192.168.178.165:3000/api/now',
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
  checkForChanges();
  fetchNow()
    .then((data) => sendResponse({ data }))
    .catch((error) => sendResponse({ error: String(error?.message ?? error) }));
  return true; // answers asynchronously
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
});

// Development: when the extension's files change on the Mac (the dev server reports their
// newest change time), reload the extension and put the new overlay into the open tabs, so
// nobody has to click reload in chrome://extensions. Does nothing without the dev server.
const DEV_STAMP = 'http://127.0.0.1:3700/__extension';
let knownStamp = null;
let lastCheck = 0;

async function checkForChanges() {
  if (Date.now() - lastCheck < 3000) return;
  lastCheck = Date.now();
  try {
    const res = await fetch(DEV_STAMP, { cache: 'no-store', signal: AbortSignal.timeout(1000) });
    const { stamp } = await res.json();
    if (knownStamp == null) knownStamp = stamp;
    else if (stamp !== knownStamp) chrome.runtime.reload();
  } catch {}
}
setInterval(checkForChanges, 3000);
checkForChanges();

// After a reload the old overlays remove themselves; inject the new one where it belongs.
chrome.runtime.onInstalled.addListener(async () => {
  const { content_scripts: [script] } = chrome.runtime.getManifest();
  const tabs = await chrome.tabs.query({ url: script.matches });
  for (const tab of tabs) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: script.js }).catch(() => {});
  }
});
