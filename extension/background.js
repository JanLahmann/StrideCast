// Fetches the current values for the overlays. Content scripts run under the page's origin
// (youtube.com), which the browser keeps from reading 127.0.0.1; the extension itself may.

const FEED = 'http://127.0.0.1:3700/api/now';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'now') return false;
  fetch(FEED, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data) => sendResponse({ data }))
    .catch((error) => sendResponse({ error: String(error?.message ?? error) }));
  return true; // answers asynchronously
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
});
