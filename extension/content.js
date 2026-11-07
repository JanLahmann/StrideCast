// StrideCast overlay on YouTube, YouTube Music and Teams recordings (SharePoint/Stream): a small stats bar or a larger panel,
// both draggable, also shown in full screen. Alt+S or the toolbar icon switches
// bar → panel → hidden.

const MODES = ['bar', 'panel', 'hidden'];
const WINDOW = 600; // seconds in the panel chart, one sample per second

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .sc { position: fixed; z-index: 2147483647; color: #EEF2F5; background: rgba(9, 13, 18, .86);
    border: 1px solid rgba(255, 255, 255, .12); border-radius: 12px; box-shadow: 0 8px 28px rgba(0, 0, 0, .45);
    font: 400 14px/1.3 "Atkinson Hyperlegible", Roboto, system-ui, sans-serif; }
  .num, .m b { font-family: "Barlow Condensed", "Roboto Condensed", "Arial Narrow", system-ui, sans-serif;
    font-weight: 600; font-variant-numeric: tabular-nums; line-height: .95; }
  small, .unit { color: #8E9BA7; font-weight: 500; }
  .power b, .power .num { color: #F5A524; } .cad b, .cad .num { color: #38BDF8; }
  .hr b, .hr .num { color: #F2506E; } .speed b, .speed .num { color: #E7ECF0; }
  button { all: unset; cursor: pointer; color: #8E9BA7; font: 700 18px/1 system-ui, sans-serif; padding: 4px 6px; border-radius: 6px; }
  button:hover, button:focus-visible { color: #EEF2F5; background: rgba(255, 255, 255, .1); }
  .grip { cursor: grab; user-select: none; touch-action: none; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #8E9BA7; flex: none; }
  [data-state="ok"] .dot, .dot[data-state="ok"] { background: #3DDC84; }
  [data-state="example"] .dot, .dot[data-state="example"] { background: #F5A524; }
  [data-state="off"] .dot, .dot[data-state="off"] { background: #F2506E; }
  [hidden] { display: none !important; }

  .bar { top: 72px; right: 24px; display: flex; align-items: center; gap: 18px; padding: 8px 10px 8px 12px; }
  .bar .m { display: flex; align-items: baseline; gap: 3px; white-space: nowrap; }
  .bar .m b { font-size: 34px; }
  .bar .m small { font-size: 13px; }
  .bar .grip { color: #586674; font-size: 16px; letter-spacing: -3px; padding-right: 2px; }

  .panel { top: 72px; right: 24px; width: 440px; height: 520px; min-width: 300px; min-height: 340px;
    resize: both; overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; container-type: size; }
  .panel header { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; border-bottom: 1px solid rgba(255, 255, 255, .08); }
  .panel header strong { font: 700 20px/1 "Barlow Condensed", "Roboto Condensed", system-ui, sans-serif; letter-spacing: .02em; }
  .panel header .status { color: #8E9BA7; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-right: auto; }
  .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 8px; padding: 10px; min-height: 0; }
  .tile { background: rgba(255, 255, 255, .05); border-radius: 10px; padding: 8px 12px; display: grid; align-content: space-between; min-height: 0; overflow: hidden; }
  .tile .lbl { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #8E9BA7; font-weight: 700; }
  .tile .num { font-size: clamp(26px, 9cqw, 120px); white-space: nowrap; }
  .tile .unit { font-size: .42em; margin-left: .12em; }
  .tile .sub { font-size: 12px; color: #8E9BA7; min-height: 1.3em; }
  .chart { padding: 0 10px 10px; display: grid; gap: 4px; }
  .chart svg { width: 100%; height: clamp(50px, 16cqh, 200px); display: block; background: rgba(255, 255, 255, .03); border-radius: 8px; }
  .legend { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 11px; color: #8E9BA7; }
  .legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 5px; }
`;

const HTML = `
  <div class="sc bar" data-mode="bar">
    <span class="grip" title="Drag">⋮⋮</span>
    <i class="dot" data-status-dot></i>
    <span class="m power"><b data-k="power">–</b><small>W</small></span>
    <span class="m cad"><b data-k="rpm">–</b><small>rpm</small></span>
    <span class="m hr"><b data-k="hr">–</b><small>bpm</small></span>
    <span class="m speed"><b data-k="speed">–</b><small>km/h</small></span>
    <span class="m speed"><b data-k="elapsed">–</b></span>
    <button data-act="panel" title="Larger panel (Alt+S)">⤢</button>
    <button data-act="hidden" title="Hide (Alt+S)">×</button>
  </div>
  <div class="sc panel" data-mode="panel">
    <header class="grip">
      <strong>StrideCast</strong>
      <span class="status"><i class="dot" data-status-dot></i><span data-status-text>Connecting…</span></span>
      <button data-act="bar" title="Small bar">⤡</button>
      <button data-act="hidden" title="Hide (Alt+S)">×</button>
    </header>
    <div class="tiles">
      <div class="tile power"><span class="lbl">Power</span><span class="num"><span data-k="power">–</span><span class="unit">W</span></span><span class="sub">target <span data-k="targetPower">–</span> W</span></div>
      <div class="tile cad"><span class="lbl">Cadence</span><span class="num"><span data-k="rpm">–</span><span class="unit">rpm</span></span><span class="sub"></span></div>
      <div class="tile hr"><span class="lbl">Heart rate</span><span class="num"><span data-k="hr">–</span><span class="unit">bpm</span></span><span class="sub"></span></div>
      <div class="tile speed"><span class="lbl">Speed</span><span class="num"><span data-k="speed">–</span><span class="unit">km/h</span></span><span class="sub"></span></div>
      <div class="tile speed"><span class="lbl">Distance</span><span class="num"><span data-k="distance">–</span><span class="unit">km</span></span><span class="sub"></span></div>
      <div class="tile speed"><span class="lbl">Time</span><span class="num" data-k="elapsed">–</span><span class="sub"><span data-k="energy">–</span> kJ</span></div>
    </div>
    <div class="chart">
      <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-label="Power and heart rate, last 10 minutes">
        <line x1="0" y1="50" x2="600" y2="50" stroke="#22303C" vector-effect="non-scaling-stroke"/>
        <polyline data-line="power" fill="none" stroke="#F5A524" stroke-width="2" vector-effect="non-scaling-stroke" points=""/>
        <polyline data-line="hr" fill="none" stroke="#F2506E" stroke-width="2" vector-effect="non-scaling-stroke" points=""/>
      </svg>
      <div class="legend"><span><i style="background:#F5A524"></i>Power, 0–200 W</span><span><i style="background:#F2506E"></i>Heart rate, 40–200 bpm</span><span>last 10 min</span></div>
    </div>
  </div>
`;

(async () => {
  const { formatValue } = await import(chrome.runtime.getURL('lib/stats.js'));
  const saved = await chrome.storage.local.get({ mode: 'bar', pos: {}, size: null });
  let mode = MODES.includes(saved.mode) ? saved.mode : 'bar';
  const pos = saved.pos;
  const history = [];

  const host = document.createElement('div');
  host.id = 'stridecast-overlay';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>${HTML}`;
  const boxes = { bar: root.querySelector('.bar'), panel: root.querySelector('.panel') };
  if (saved.size) Object.assign(boxes.panel.style, { width: `${saved.size.w}px`, height: `${saved.size.h}px` });

  // Keep the overlay inside the full-screen element, or it disappears behind the video.
  const attach = () => (document.fullscreenElement ?? document.documentElement).append(host);
  document.addEventListener('fullscreenchange', attach);
  attach();

  function place(box, name) {
    const p = pos[name];
    if (!p) return;
    const left = Math.min(Math.max(0, p.left), innerWidth - 60);
    const top = Math.min(Math.max(0, p.top), innerHeight - 40);
    Object.assign(box.style, { left: `${left}px`, top: `${top}px`, right: 'auto' });
  }

  function setMode(next) {
    mode = next;
    for (const [name, box] of Object.entries(boxes)) {
      box.hidden = name !== mode;
      if (name === mode) place(box, name);
    }
    chrome.storage.local.set({ mode });
  }

  // Dragging by the grip; positions are kept per mode.
  for (const [name, box] of Object.entries(boxes)) {
    const grip = box.querySelector('.grip');
    grip.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const start = box.getBoundingClientRect();
      const dx = e.clientX - start.left;
      const dy = e.clientY - start.top;
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        pos[name] = { left: ev.clientX - dx, top: ev.clientY - dy };
        place(box, name);
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        chrome.storage.local.set({ pos });
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }

  let sizeTimer;
  new ResizeObserver(([entry]) => {
    if (boxes.panel.hidden) return;
    clearTimeout(sizeTimer);
    const { width, height } = entry.target.getBoundingClientRect();
    sizeTimer = setTimeout(() => chrome.storage.local.set({ size: { w: Math.round(width), h: Math.round(height) } }), 300);
  }).observe(boxes.panel);

  root.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act) setMode(act);
  });
  const cycle = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  addEventListener('keydown', (e) => {
    if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyS') {
      e.preventDefault();
      e.stopPropagation();
      cycle();
    }
  }, true);
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'toggle') cycle();
  });

  function setStatus(state, text) {
    for (const dot of root.querySelectorAll('[data-status-dot]')) dot.dataset.state = state;
    root.querySelector('[data-status-text]').textContent = text;
  }

  const y = (v, lo, hi) => (100 - ((Math.min(hi, Math.max(lo, v ?? lo)) - lo) / (hi - lo)) * 100).toFixed(1);
  function drawChart() {
    const offset = WINDOW - history.length;
    for (const [key, lo, hi] of [['power', 0, 200], ['hr', 40, 200]]) {
      root.querySelector(`[data-line="${key}"]`).setAttribute('points', history.map((d, i) => `${offset + i},${y(d[key], lo, hi)}`).join(' '));
    }
  }

  async function poll() {
    if (!chrome.runtime?.id) {
      // The extension was reloaded or removed; this copy of the script is orphaned.
      clearInterval(timer);
      host.remove();
      return;
    }
    if (document.hidden) return;
    let reply;
    try {
      reply = await chrome.runtime.sendMessage({ type: 'now' });
    } catch (error) {
      reply = { error: String(error) };
    }
    const data = reply?.data;
    if (!data) {
      setStatus('off', 'No data: is StrideCast running?');
      return;
    }
    for (const el of root.querySelectorAll('[data-k]')) el.textContent = formatValue(el.dataset.k, data);
    if (data.source === 'example') setStatus('example', 'Example data');
    else if (data.connected === false) {
      setStatus('off', 'ELYX not connected');
      return;
    } else setStatus('ok', 'ELYX');
    history.push(data);
    if (history.length > WINDOW) history.shift();
    if (mode === 'panel') drawChart();
  }

  setMode(mode);
  const timer = setInterval(poll, 1000);
  poll();
})();
