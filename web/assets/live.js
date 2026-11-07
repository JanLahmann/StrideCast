// Live feed: subscribes to /api/live, fills every [data-k] element and reports the source
// in every [data-status] element.

import { formatValue } from './stats.js';

export function render(data, root = document) {
  for (const el of root.querySelectorAll('[data-k]')) el.textContent = formatValue(el.dataset.k, data);
}

function setStatus(state, text) {
  for (const el of document.querySelectorAll('[data-status]')) {
    el.dataset.state = state;
    el.querySelector('b').textContent = text;
  }
}

export function startLive(onData) {
  const source = new EventSource('/api/live');
  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    render(data);
    if (data.source === 'example') setStatus('example', 'Example data');
    else setStatus('ok', 'ELYX');
    onData?.(data);
  };
  source.onerror = () => setStatus('off', 'No data');
  return source;
}
