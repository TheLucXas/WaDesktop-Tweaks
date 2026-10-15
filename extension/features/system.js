/* System: language, profiles, backup, diagnostics, updates, uninstall, about. */
(() => {
  const WAT = window.WAT; if (!WAT) return;
  const { t, el } = WAT;

  const langOptions = () => [{ v: 'auto', label: t('sys.langAuto') + ' (' + WAT.languages[WAT.detectLang()] + ')' }].concat(Object.entries(WAT.languages).map(([v, label]) => ({ v, label })));
  const profileOptions = () => WAT.profiles().map(p => ({ v: p, label: p === 'default' ? t('sys.profileDefault') : p }));

  WAT.section('system', [
    { id: 'language', type: 'select', def: 'auto', global: true, rerender: true, options: langOptions },
    { id: 'profileSelect', type: 'select', rerender: true, options: profileOptions, getValue: () => WAT.activeProfile(), onSet: v => WAT.useProfile(v) },
    { id: 'profileNew', type: 'action', run: async ({ rerender }) => {
      const name = await WAT.prompt(t('f.profileNew.name'), t('sys.profileNameHint')); if (!name) return;
      if (!WAT.newProfile(name, WAT.activeProfile())) { WAT.toast(t('ui.error'), t('sys.profileExists'), 'warn'); return; }
      WAT.useProfile(name.trim().slice(0, 40)); rerender();
    } },
    { id: 'profileDelete', type: 'action', danger: true, run: async ({ rerender }) => {
      const p = WAT.activeProfile(); if (p === 'default') { WAT.toast(t('ui.error'), t('sys.profileNoDelete'), 'warn'); return; }
      if (await WAT.confirm(t('f.profileDelete.name'), p, t('ui.delete'), true)) { WAT.deleteProfile(p); rerender(); }
    } },
    { id: 'exportCfg', type: 'action', run: () => WAT.download('wadesktop-tweaks-settings.json', WAT.exportConfig(), 'application/json') },
    { id: 'importCfg', type: 'action', run: ({ rerender }) => new Promise(res => {
      const inp = el('input', { type: 'file', accept: '.json,application/json' });
      inp.onchange = async () => {
        try { const f = inp.files[0]; if (!f) return res(); WAT.importConfig(await f.text()); WAT.toast(t('ui.done'), t('sys.imported')); rerender(); }
        catch (e) { WAT.toast(t('ui.error'), String(e.message || e), 'err'); }
        res();
      };
      inp.click();
    }) },
    { id: 'diagnostics', type: 'action', run: () => runDiagnostics() },
    { id: 'updateCheck', type: 'toggle', def: true, global: true },
    { id: 'updateNow', type: 'action', run: async ({ btn }) => { const r = await checkUpdate(true); if (r === 'none') WAT.toast(t('upd.latest'), 'v' + WAT.version); } },
    { id: 'uninstall', type: 'action', danger: true, run: () => uninstall() },
    { id: 'aboutInfo', type: 'info' },
  ], 90);


  /* ---------- diagnostics ---------- */
  function checks() {
    const R = n => { try { return window.require(n); } catch { return null; } };
    const has = (mod, fn) => { const m = R(mod); return !!(m && (fn ? typeof m[fn] === 'function' : m)); };
    const patched = !!(R('WAWebSendReadReceiptJob') || {}).__watPatched;
    const rows = [
      ['Extension loaded', true],
      ['WhatsApp module loader', typeof window.require === 'function'],
      ['Read receipts hook', patched],
      ['Typing / recording hook', has('WAWebChatStateBridge', 'sendChatStateComposing')],
      ['Presence hook', has('WAWebPresenceChatAction', 'sendPresenceAvailable')],
      ['Played-receipt hook', has('WAWebMarkPlayedMsgAction', 'markPlayed')],
      ['Sticker action', has('WAWebSendStickerAction', 'sendStickerToChat')],
      ['Reaction action', has('WAWebSendReactionMsgAction', 'sendReactionToMsg')],
      ['Message events', (() => { try { return typeof R('WAWebCollections').Msg.on === 'function'; } catch { return false; } })()],
      ['GIF send flow', has('WAWebComposeBoxUtils', 'fetchGif') && has('WAWebCmd')],
      ['Load earlier messages (export)', has('WAWebChatLoadMessages', 'loadEarlierMsgs')],
      ['Text send (scheduler)', has('WAWebSendTextMsgChatAction', 'sendTextMsgToChat')],
      ['Media decrypt helper (statuses)', has('WAWebMediaDataUtils', 'opaqueDataToArrayBuffer')],
      ['Chat list DOM', !!document.querySelector('#pane-side [role="row"]')],
      ['Side-bar DOM', !!document.querySelector('button[data-navbar-item]')],
      ['Message meta DOM', !document.querySelector('[data-id]') || !!document.querySelector('[data-testid="msg-meta"]')],
    ];
    return rows;
  }
  /* Structure-only outline of the parts of the page the tweaks touch: tags, classes, key layout styles and sizes.
   * No message text, names, numbers or ids — text is shown as a character count. Attach it to a "looks misaligned"
   * report so a WhatsApp layout change can be fixed without guessing. */
  function layoutReport() {
    const out = [];
    const TIME = /^\s*\d{1,2}[:.]\d{2}([:.]\d{2})?\s*([ap]\.?\s?m\.?)?\s*$/i;
    const KEEP = /^(data-icon|data-testid|data-navbar-item|data-navbar-item-index|data-wat-del|data-wat-pad|role|dir|aria-hidden|aria-current|type|tabindex)$/;
    const STY = ['display', 'position', 'flexDirection', 'alignItems', 'whiteSpace', 'visibility', 'paddingBottom'];
    const budget = { n: 0 };
    const walk = (node, depth, max) => {
      if (budget.n > 700) return;
      const pad = '  '.repeat(depth);
      if (node.nodeType === 3) { const s = node.nodeValue; if (s.trim()) { out.push(pad + '"' + (TIME.test(s) ? s.trim() : '[' + s.length + ' chars]') + '"'); budget.n++; } return; }
      if (node.nodeType !== 1) return;
      const cs = getComputedStyle(node), r = node.getBoundingClientRect(), a = [];
      for (const at of node.attributes) {
        if (at.name === 'class') a.push('class="' + at.value + '"');
        else if (at.name === 'style') a.push('style="' + at.value.replace(/url\([^)]*\)/g, 'url()').slice(0, 160) + '"');
        else if (KEEP.test(at.name)) a.push(at.name + '="' + at.value + '"');
        else if (at.name === 'aria-label' || at.name === 'title') a.push(at.name + '=[' + at.value.length + ' chars]');
        else a.push(at.name + '=[…]');
      }
      const sty = STY.map(k => k + ':' + cs[k]).join(' ');
      out.push(pad + '<' + node.tagName.toLowerCase() + (a.length ? ' ' + a.join(' ') : '') + '> ' + Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + sty);
      budget.n++;
      if (depth >= max) { if (node.childNodes.length) out.push(pad + '  …'); return; }
      node.childNodes.forEach(c => walk(c, depth + 1, max));
    };
    out.push('WaDesktop-Tweaks v' + WAT.version + ' layout report', 'viewport ' + innerWidth + 'x' + innerHeight + ' dpr=' + devicePixelRatio, '');
    // 1) the left rail (hide Channels / Communities / Status / Meta AI)
    const nav = [...document.querySelectorAll('[data-navbar-item]')];
    out.push('## rail: ' + nav.length + ' [data-navbar-item] element(s)');
    if (nav.length) {
      let root = nav[0].parentElement;
      for (let i = 0; i < 5 && root && !nav.every(n => root.contains(n)); i++) root = root.parentElement;
      walk(root && root.parentElement ? root.parentElement : root, 0, 7);
    }
    // 2) a message row: the last one carrying a recovered text, otherwise the last row on screen
    const painted = [...document.querySelectorAll('[data-wat-del]')].pop();
    const rows = [...document.querySelectorAll('[data-id]')];
    const row = (painted && painted.closest('[data-id]')) || rows.pop();
    out.push('', '## message row (' + (painted ? 'recovered deleted message' : 'last row') + ')');
    if (row) walk(row, 0, 16); else out.push('(no message row on screen — open a chat first)');
    return out.join(String.fromCharCode(10));
  }

  async function runDiagnostics() {
    const rows = checks();
    let net = 'ok';
    try { const r = await WAT.fetchRaw('https://api.github.com/repos/' + WAT.repo + '/releases/latest'); net = r.error ? 'error: ' + r.error : 'HTTP ' + r.status; } catch (e) { net = String(e); }
    rows.push(['Extension network bridge', !/error/.test(net), net]);
    const ov = el('div', { class: 'wat-ov' });
    const close = () => ov.remove();
    const text = ['WaDesktop-Tweaks v' + WAT.version, 'lang=' + WAT.lang(), ...rows.map(r => (r[1] ? 'OK   ' : 'FAIL ') + r[0] + (r[2] ? ' (' + r[2] + ')' : '')), '--- log ---', ...WAT.logs.slice(-30)].join(String.fromCharCode(10));
    ov.append(el('div', { class: 'wat-panel', style: 'display:block;width:min(560px,94vw);height:auto;max-height:86vh;overflow:auto;padding:16px 18px' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, el('h2', { style: 'margin:0;font-size:17px' }, t('f.diagnostics.name')), el('button', { class: 'wat-x', onclick: close }, '✕')),
      el('div', { class: 'wat-hint' }, t('sys.diagHint')),
      el('div', {}, rows.map(r => el('div', { class: 'wat-row', style: 'padding:6px 0' }, el('div', { class: 'txt' }, r[0]), el('div', { style: 'font-weight:700;color:' + (r[1] ? '#00a884' : '#e5484d') }, r[1] ? '✔' : '✖')))),
      el('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' },
        el('button', { class: 'wat-btn', onclick: () => navigator.clipboard && navigator.clipboard.writeText(text).then(() => WAT.toast(t('ui.done'))) }, t('sys.copyReport')),
        el('button', { class: 'wat-btn', onclick: () => navigator.clipboard && navigator.clipboard.writeText(layoutReport()).then(() => WAT.toast(t('ui.done'))) }, t('sys.copyLayout'))),
      el('div', { class: 'wat-hint' }, t('sys.layoutHint'))));
    document.body.appendChild(ov); ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  }

  /* ---------- updates (GitHub Releases) ---------- */
  const newer = (a, b) => { const p = s => String(s).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; } return false; };
  async function checkUpdate(manual) {
    try {
      const j = await WAT.fetchJson('https://api.github.com/repos/' + WAT.repo + '/releases/latest');
      if (j && j.tag_name && newer(j.tag_name, WAT.version)) {
        WAT.__update = { tag: j.tag_name, url: j.html_url };
        const n = WAT.toast(t('upd.available', { v: j.tag_name }), t('upd.how'), '');
        n.style.cursor = 'pointer'; n.onclick = () => showSteps(t('upd.available', { v: j.tag_name }), t('upd.steps'), CMD_UPDATE);
        return 'new';
      }
      return 'none';
    } catch (e) {
      if (manual) WAT.toast(t('upd.failed'), String(e.message || e), 'warn');
      return 'error';
    }
  }
  setTimeout(() => {
    if (!WAT.get('updateCheck')) return;
    let last = 0; try { last = Number(localStorage.getItem('wat.lastUpdateCheck')) || 0; } catch {}
    if (Date.now() - last < 24 * 3600e3) return;
    try { localStorage.setItem('wat.lastUpdateCheck', String(Date.now())); } catch {}
    checkUpdate(false);
  }, 20000);

  /* ---------- uninstall ---------- */
  // A web page cannot start programs, so the last step is done by the user from the Start menu / Win+R.
  const CMD_UNINSTALL = 'powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\WaDesktop-Tweaks\\installer\\uninstall.ps1"';
  const CMD_UPDATE = 'powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\WaDesktop-Tweaks\\installer\\update.ps1"';
  async function showSteps(title, body, cmd) {
    try { await navigator.clipboard.writeText(cmd); } catch {}
    const ov = el('div', { class: 'wat-ov' });
    const close = () => ov.remove();
    ov.append(el('div', { class: 'wat-panel', style: 'display:block;width:min(520px,94vw);height:auto;padding:18px 20px' },
      el('h2', { style: 'margin:0 0 8px;font-size:17px' }, title),
      el('div', { class: 'wat-hint', style: 'white-space:pre-wrap;font-size:13px' }, body),
      el('code', { style: 'display:block;margin:10px 0;padding:8px;border-radius:8px;background:var(--background-default-hover,#2a2f32);word-break:break-all;font-size:12px' }, cmd),
      el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' },
        el('button', { class: 'wat-btn', onclick: async () => { try { await navigator.clipboard.writeText(cmd); WAT.toast(t('un.copied')); } catch {} } }, t('un.copyCmd')),
        el('button', { class: 'wat-btn pri', onclick: close }, t('ui.ok')))));
    document.body.appendChild(ov); ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  }
  async function uninstall() {
    if (!(await WAT.confirm(t('un.title'), t('un.body'), t('un.go'), true))) return;
    if (!(await WAT.confirm(t('un.title2'), t('un.body2'), t('un.go2'), true))) return;
    showSteps(t('un.stepsTitle'), t('un.steps'), CMD_UNINSTALL);
  }
})();
