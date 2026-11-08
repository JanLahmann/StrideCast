// For browsers without JavaScript modules (e.g. the built-in browser of older Samsung
// displays): polls /api/now once per second and fills the same [data-k] and [data-status]
// elements as live.js, plus the dashboard chart. Plain ES5 on purpose; loaded with nomodule,
// so current browsers skip it. Keep the formatting in step with stats.js.
(function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function formatTime(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return h ? h + ':' + pad(m) + ':' + pad(s % 60) : m + ':' + pad(s % 60);
  }

  function formatValue(key, data) {
    var v = data ? data[key] : undefined;
    if (typeof v !== 'number' || isNaN(v)) return '–';
    if (key === 'hr') return v > 0 ? String(Math.round(v)) : '–';
    if (key === 'speed') return v.toFixed(1);
    if (key === 'distance') return v.toFixed(2);
    if (key === 'elapsed') return formatTime(v);
    return String(Math.round(v));
  }

  function each(selector, fn) {
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function setStatus(state, text) {
    each('[data-status]', function (el) {
      el.setAttribute('data-state', state);
      el.querySelector('b').textContent = text;
    });
  }

  var WINDOW = 600; // seconds in the dashboard chart
  var history = [];
  function y(v, lo, hi) {
    return (100 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * 100).toFixed(1);
  }
  function points(key, lo, hi) {
    var offset = WINDOW - history.length;
    var out = [];
    for (var i = 0; i < history.length; i++) out.push((offset + i) + ',' + y(history[i][key], lo, hi));
    return out.join(' ');
  }

  function show(data) {
    each('[data-k]', function (el) { el.textContent = formatValue(el.getAttribute('data-k'), data); });
    if (data.source === 'example') setStatus('example', 'Example data');
    else if (data.connected === false) setStatus('off', 'ELYX not connected');
    else setStatus('ok', 'ELYX');
    var power = document.getElementById('powerLine');
    var hr = document.getElementById('hrLine');
    if (power && hr && data.connected !== false) {
      history.push(data);
      if (history.length > WINDOW) history.shift();
      power.setAttribute('points', points('power', 0, 200));
      hr.setAttribute('points', points('hr', 40, 200));
    }
  }

  function poll() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/now?t=' + Date.now());
    xhr.timeout = 3000;
    xhr.onload = function () {
      try { show(JSON.parse(xhr.responseText)); } catch (e) { setStatus('off', 'No data'); }
    };
    xhr.onerror = xhr.ontimeout = function () { setStatus('off', 'No data'); };
    xhr.send();
  }

  poll();
  setInterval(poll, 1000);
})();
