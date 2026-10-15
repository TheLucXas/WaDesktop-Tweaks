/* On-screen privacy: blur, PIN screen lock, panic button.
 * The PIN is a screen cover to stop casual glances. It does NOT encrypt your data. */
(() => {
  const WAT = window.WAT; if (!WAT) return;
  const { t, el } = WAT;

  WAT.section('security', [
    { id: 'blurList', type: 'toggle', def: false },
    { id: 'blurMsgs', type: 'toggle', def: false },
    { id: 'blurUnfocus', type: 'toggle', def: false },
    { id: 'blurShortcut', type: 'shortcut', def: 'Ctrl+Alt+B' },
    { id: 'panicShortcut', type: 'shortcut', def: 'Ctrl+Alt+P' },
    { id: 'panicButton', type: 'toggle', def: true },
    { id: 'pinEnabled', type: 'toggle', def: false },
    { id: 'pinSet', type: 'action', run: () => setPin() },
    { id: 'lockMinutes', type: 'number', def: 5, min: 0, max: 240, showIf: () => WAT.on('pinEnabled') },
    { id: 'lockNow', type: 'action', run: ({ close }) => { close(); lockNow(); } },
    { id: 'lockShortcut', type: 'shortcut', def: 'Ctrl+Alt+L' },
  ], 70);

  const st = document.createElement('style');
  st.textContent = `
  html.wat-blur-list #pane-side [role="row"]{filter:blur(7px);transition:filter .12s}
  html.wat-blur-list #pane-side [role="row"]:hover{filter:none}
  html.wat-blur-msgs [data-id]{filter:blur(7px);transition:filter .12s}
  html.wat-blur-msgs [data-id]:hover{filter:none}
  html.wat-unfocus #app,html.wat-unfocus .wat-gear,html.wat-unfocus .wat-act,html.wat-unfocus .wat-save,html.wat-unfocus .wat-toast,html.wat-unfocus .wat-ov{filter:blur(14px)}
  #wat-lock{position:fixed;inset:0;z-index:2147483647;background:#0b141a;color:#e9edef;display:flex;align-items:center;justify-content:center;font:15px/1.4 system-ui,sans-serif}
  #wat-lock .box{width:min(320px,88vw);text-align:center}
  #wat-lock h2{margin:0 0 6px;font-size:20px}
  #wat-lock input{width:100%;box-sizing:border-box;margin:14px 0 8px;padding:10px 12px;border-radius:10px;border:1px solid #2a3942;background:#1f2c34;color:inherit;font-size:18px;text-align:center;letter-spacing:.2em}
  #wat-lock button{width:100%;padding:10px;border:0;border-radius:10px;background:#00a884;color:#fff;font-size:15px;cursor:pointer}
  #wat-lock .err{color:#f15c6d;min-height:20px;font-size:13px}`;
  const addStyle = () => { if (document.documentElement && !st.isConnected) document.documentElement.appendChild(st); };

  setInterval(() => {
    addStyle();
    const r = document.documentElement; if (!r) return;
    r.classList.toggle('wat-blur-list', WAT.on('blurList'));
    r.classList.toggle('wat-blur-msgs', WAT.on('blurMsgs'));
    r.classList.toggle('wat-unfocus', WAT.on('blurUnfocus') && !document.hasFocus());
    idleCheck();
  }, 300);
  window.addEventListener('blur', () => { if (WAT.on('blurUnfocus') && document.documentElement) document.documentElement.classList.add('wat-unfocus'); });
  window.addEventListener('focus', () => document.documentElement && document.documentElement.classList.remove('wat-unfocus'));

  WAT.addShortcut('blurShortcut', () => { const v = !(WAT.on('blurList') || WAT.on('blurMsgs')); WAT.set('blurList', v); WAT.set('blurMsgs', v); });

  /* ---------- PIN ---------- */
  const enc = new TextEncoder();
  const hash = async (pin, salt) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + pin)))).map(x => x.toString(16).padStart(2, '0')).join('');
  const ls = { g: k => { try { return localStorage.getItem(k); } catch { return null; } }, s: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  async function setPin() {
    const pin = await WAT.prompt(t('pin.new'), t('pin.newBody'), { secret: true });
    if (pin === null) return;
    if (pin.length < 4 || pin.length > 12) { WAT.toast(t('pin.invalid'), t('pin.newBody'), 'warn'); return; }
    const again = await WAT.prompt(t('pin.confirm'), '', { secret: true });
    if (again !== pin) { WAT.toast(t('pin.mismatch'), '', 'warn'); return; }
    const salt = crypto.getRandomValues(new Uint8Array(12)).join('');
    ls.s('wat.pinSalt', salt); ls.s('wat.pinHash', await hash(pin, salt));
    WAT.toast(t('pin.saved'));
  }
  let lastAct = Date.now(), lastIdle = 0;
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastAct = Date.now(); }, true));
  function idleCheck() {
    if (Date.now() - lastIdle < 5000) return; lastIdle = Date.now();
    if (!WAT.on('pinEnabled') || WAT.__locked || !ls.g('wat.pinHash')) return;
    const m = Number(WAT.get('lockMinutes')) || 0;
    if (m > 0 && Date.now() - lastAct > m * 60000) lockNow();
  }
  function lockNow() {
    if (WAT.__locked) return;
    if (!ls.g('wat.pinHash')) { WAT.toast(t('pin.none'), t('pin.noneBody'), 'warn'); return; }
    WAT.__locked = true;
    const inp = el('input', { type: 'password', autocomplete: 'off', 'aria-label': 'PIN' });
    const err = el('div', { class: 'err' });
    const box = el('div', { id: 'wat-lock' }, el('div', { class: 'box' }, el('h2', {}, '🔒 ' + t('pin.locked')), el('div', {}, t('pin.enter')), inp, err,
      el('button', { onclick: tryUnlock }, t('pin.unlock'))));
    async function tryUnlock() {
      if ((await hash(inp.value, ls.g('wat.pinSalt') || '')) === ls.g('wat.pinHash')) { box.remove(); WAT.__locked = false; lastAct = Date.now(); }
      else { err.textContent = t('pin.wrong'); inp.value = ''; inp.focus(); }
    }
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') tryUnlock(); });
    document.body.appendChild(box); inp.focus();
  }
  WAT.lockNow = lockNow;
  WAT.addShortcut('lockShortcut', lockNow);
  setTimeout(() => { if (WAT.on('pinEnabled') && ls.g('wat.pinHash')) lockNow(); }, 1200);

  /* ---------- panic ---------- */
  function panic() {
    if (WAT.__locked || document.getElementById('wat-panic')) return;
    if (ls.g('wat.pinHash')) { lockNow(); return; }
    const c = el('div', { id: 'wat-panic', style: 'position:fixed;inset:0;z-index:2147483646;background:#0b141a;color:#8696a0;display:flex;align-items:center;justify-content:center;font:15px system-ui;cursor:pointer', onclick: () => c.remove() }, t('panic.cover'));
    document.body.appendChild(c);
  }
  WAT.panic = panic;
  WAT.addShortcut('panicShortcut', panic);
  WAT.addQuickAction('🛡', 'f.panicButton.name', panic, () => WAT.on('panicButton'));
})();
