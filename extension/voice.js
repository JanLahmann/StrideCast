// Voice commands: VoiceInk (or any dictation app) pastes the spoken text into the page. When
// no text field has the focus, that paste is a command: it goes to the dev server's local
// model (server/assistant.mjs) and the answer shows briefly at the top of the page.
// Alt+V opens a small field for typing a command, or for dictating while a text field on
// the page (WhatsApp, Teams) would otherwise take the paste.

(() => {
  const CSS = `
    :host { all: initial; }
    .box { position: fixed; z-index: 2147483647; top: 18px; left: 50%; transform: translateX(-50%);
      max-width: min(720px, calc(100vw - 32px)); display: grid; gap: 4px; padding: 10px 16px;
      color: #EEF2F5; background: rgba(9, 13, 18, .9); border: 1px solid rgba(255, 255, 255, .14);
      border-radius: 12px; box-shadow: 0 8px 28px rgba(0, 0, 0, .45);
      font: 400 18px/1.35 "Atkinson Hyperlegible", Roboto, system-ui, sans-serif; }
    .said { color: #8E9BA7; font-size: 15px; }
    .said:empty { display: none; }
    .reply[data-state="busy"] { color: #8E9BA7; }
    .reply[data-state="error"] { color: #F2506E; }
    input { all: unset; min-width: 360px; font: inherit; color: #EEF2F5;
      border-bottom: 1px solid rgba(255, 255, 255, .25); padding: 2px 0; }
    [hidden] { display: none !important; }
  `;

  document.getElementById('stridecast-voice')?.remove(); // left by a copy before a reload
  const host = document.createElement('div');
  host.id = 'stridecast-voice';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style><div class="box" hidden>
    <input placeholder="Befehl für StrideCast (Enter)" hidden>
    <div class="said"></div><div class="reply"></div></div>`;
  const box = root.querySelector('.box');
  const input = root.querySelector('input');
  const said = root.querySelector('.said');
  const reply = root.querySelector('.reply');
  let hideTimer;

  // In full screen only the full-screen element is visible.
  const attach = () => (document.fullscreenElement ?? document.documentElement).append(host);
  document.addEventListener('fullscreenchange', () => { if (host.isConnected) attach(); });

  function show(text, state, ms) {
    clearTimeout(hideTimer);
    attach();
    box.hidden = false;
    reply.textContent = text;
    reply.dataset.state = state;
    if (ms) hideTimer = setTimeout(() => { if (input.hidden) box.hidden = true; }, ms);
  }

  // false once the extension was reloaded: this copy of the script is stale.
  const alive = () => Boolean(chrome.runtime?.id);

  async function ask(text) {
    said.textContent = `🎙 ${text}`;
    show('…', 'busy');
    try {
      const answer = await chrome.runtime.sendMessage({ type: 'ask', text });
      show(answer?.reply ?? 'keine Antwort', answer?.ok ? 'ok' : 'error', answer?.ok ? 4000 : 8000);
    } catch (error) {
      show(String(error?.message ?? error), 'error', 8000);
    }
  }

  const editable = (el) => el instanceof Element
    && (el.isContentEditable || el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));

  function onPaste(e) {
    if (!alive()) return removeEventListener('paste', onPaste, true);
    const target = e.composedPath()[0];
    if (target === input || editable(target) || editable(document.activeElement)) return;
    const text = e.clipboardData?.getData('text/plain')?.trim();
    if (!text || text.length > 300) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    ask(text);
  }
  addEventListener('paste', onPaste, true);

  function close() {
    input.hidden = true;
    input.value = '';
    box.hidden = true;
  }
  function submit() {
    const text = input.value.trim();
    input.hidden = true;
    input.value = '';
    if (text) ask(text);
    else box.hidden = true;
  }
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep the page's own shortcuts (YouTube: k, f, …) out of the field
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') close();
  });
  // Dictation pastes the whole command at once: send it right away.
  input.addEventListener('paste', () => setTimeout(submit, 0));
  input.addEventListener('blur', () => { if (!input.value.trim()) close(); });

  function onKey(e) {
    if (!alive()) return removeEventListener('keydown', onKey, true);
    if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyV') {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(hideTimer);
      attach();
      said.textContent = '';
      reply.textContent = '';
      box.hidden = false;
      input.hidden = false;
      input.focus();
    }
  }
  addEventListener('keydown', onKey, true);
})();
