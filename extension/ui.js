/* WaDesktop-Tweaks — user interface: settings panel, dialogs, toasts, header buttons. */
(() => {
  const WAT = window.WAT; if (!WAT || WAT.__ui) return; WAT.__ui = true;
  const { el, t } = WAT;

  const CSS = `
  .wat-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:14px/1.4 system-ui,Segoe UI,sans-serif}
  .wat-panel{width:min(820px,95vw);height:min(640px,90vh);display:flex;background:var(--background-default,#1d1f1f);color:var(--primary,#e9edef);border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.5)}
  .wat-nav{width:200px;flex:none;border-right:1px solid var(--border-default,rgba(134,150,160,.2));padding:12px 8px;overflow:auto}
  .wat-nav h2{font-size:15px;margin:4px 8px 10px}
  .wat-nav button{display:block;width:100%;text-align:left;background:transparent;border:0;color:inherit;font:inherit;padding:8px 10px;border-radius:8px;cursor:pointer}
  .wat-nav button:hover{background:var(--background-default-hover,rgba(134,150,160,.15))}
  .wat-nav button[aria-current=true]{background:var(--teal,#00a884);color:#fff}
  .wat-main{flex:1;display:flex;flex-direction:column;min-width:0}
  .wat-head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border-default,rgba(134,150,160,.2))}
  .wat-head .t{font-weight:700;font-size:16px;flex:1}
  .wat-head .wat-q{flex:none;width:210px;max-width:40%}
  .wat-sechead{margin:16px 0 0;padding-top:4px;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--secondary,#8696a0)}
  .wat-sechead:first-child{margin-top:8px}
  .wat-body{padding:4px 16px 16px;overflow:auto;flex:1}
  .wat-x{background:transparent;border:0;color:inherit;font-size:20px;cursor:pointer}
  .wat-row{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--border-default,rgba(134,150,160,.18))}
  .wat-row:first-child{border-top:0}
  .wat-row .txt{flex:1 1 0;cursor:help;min-width:150px}
  .wat-row > :last-child:not(.txt){flex:none;max-width:260px}
  .wat-row select.wat-in{max-width:260px;text-overflow:ellipsis}
  .wat-row .n{font-weight:600}
  .wat-row .d{color:var(--secondary,#8696a0);font-size:12.5px;margin-top:2px}
  .wat-col{flex-direction:column;align-items:stretch}
  .wat-risk{display:inline-block;margin-left:6px;cursor:help;font-size:13px}
  .wat-sw{flex:none;width:42px;height:24px;border-radius:12px;background:#54656f;position:relative;cursor:pointer;border:0;padding:0;transition:background .15s}
  .wat-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}
  .wat-sw[aria-checked=true]{background:var(--teal,#00a884)}
  .wat-sw[aria-checked=true]::after{left:21px}
  .wat-in{background:var(--background-default-hover,#2a2f32);color:inherit;border:1px solid var(--border-default,rgba(134,150,160,.35));border-radius:8px;padding:6px 8px;font:inherit;max-width:100%}
  textarea.wat-in{width:100%;min-height:90px;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:12.5px}
  .wat-btn{border:1px solid var(--border-default,rgba(134,150,160,.35));background:var(--background-default,#1d1f1f);color:inherit;border-radius:16px;padding:6px 12px;cursor:pointer;white-space:nowrap;font:inherit}
  .wat-btn:hover{background:var(--background-default-hover,#2a2f32)}
  .wat-btn.pri{background:var(--teal,#00a884);color:#fff;border-color:transparent}
  .wat-btn.dang{background:#b3261e;color:#fff;border-color:transparent}
  .wat-hint{color:var(--secondary,#8696a0);font-size:12px;padding:8px 0}
  .wat-gear{position:fixed;z-index:2147483000;width:36px;height:36px;border-radius:50%;border:0;background:transparent;color:var(--icon,#aebac1);font-size:19px;cursor:pointer;display:none}
  .wat-gear:hover{background:var(--background-default-hover,rgba(134,150,160,.15))}
  .wat-act{position:fixed;top:54px;right:190px;z-index:2147483000;display:none;gap:6px;font:13px/1 system-ui,sans-serif}
  .wat-toast{position:fixed;right:18px;bottom:90px;z-index:2147483700;max-width:360px;background:#1f2c34;color:#e9edef;border-left:4px solid #00a884;border-radius:10px;padding:10px 12px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)}
  .wat-toast.warn{border-left-color:#f5a623}.wat-toast.err{border-left-color:#e5484d}
  .wat-toast .a{font-weight:700;margin-bottom:3px}.wat-toast .b{white-space:pre-wrap;word-break:break-word}
  .wat-list .it{padding:10px 0;border-top:1px solid var(--border-default,rgba(134,150,160,.2))}
  .wat-list .h{font-size:12px;color:var(--secondary,#8696a0)}
  .wat-list .b{white-space:pre-wrap;word-break:break-word;margin-top:3px}
  .wat-list img{max-width:160px;border-radius:8px;display:block;margin-top:6px}
  .wat-tabs{display:flex;gap:6px;margin:8px 0}
  .wat-tabs button[aria-pressed=true]{background:var(--teal,#00a884);color:#fff;border-color:transparent}
  @media (max-width:640px){.wat-nav{width:120px}}`;

  /* ---------- toast / dialogs ---------- */
  WAT.toast = (title, body, kind) => {
    const n = el('div', { class: 'wat-toast ' + (kind || '') }, el('div', { class: 'a' }, title), body ? el('div', { class: 'b' }, body) : null);
    document.body.appendChild(n); setTimeout(() => n.remove(), 8000); return n;
  };
  function dialog(build) {
    return new Promise(res => {
      const ov = el('div', { class: 'wat-ov' });
      const p = el('div', { class: 'wat-panel', style: 'width:min(420px,92vw);height:auto;display:block;padding:18px 20px' });
      const done = v => { ov.remove(); document.removeEventListener('keydown', k, true); res(v); };
      const k = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
      document.addEventListener('keydown', k, true);
      build(p, done); ov.append(p); document.body.appendChild(ov);
      ov.addEventListener('mousedown', e => { if (e.target === ov) done(null); });
    });
  }
  WAT.confirm = (title, body, okLabel, danger) => dialog((p, done) => {
    p.append(el('h2', { style: 'margin:0 0 6px;font-size:17px' }, title), el('div', { class: 'wat-hint', style: 'white-space:pre-wrap' }, body),
      el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px' },
        el('button', { class: 'wat-btn', onclick: () => done(false) }, t('ui.cancel')),
        el('button', { class: 'wat-btn ' + (danger ? 'dang' : 'pri'), onclick: () => done(true) }, okLabel || t('ui.ok'))));
  }).then(v => v === true);
  WAT.prompt = (title, body, opts) => dialog((p, done) => {
    opts = opts || {};
    const inp = el('input', { class: 'wat-in', style: 'width:100%;box-sizing:border-box;margin-top:10px', type: opts.secret ? 'password' : 'text', value: opts.value || '' });
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); });
    p.append(el('h2', { style: 'margin:0 0 6px;font-size:17px' }, title), el('div', { class: 'wat-hint' }, body || ''), inp,
      el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px' },
        el('button', { class: 'wat-btn', onclick: () => done(null) }, t('ui.cancel')),
        el('button', { class: 'wat-btn pri', onclick: () => done(inp.value) }, t('ui.ok'))));
    setTimeout(() => inp.focus(), 30);
  });

  /* ---------- settings panel ---------- */
  let ovEl = null, curSection = null;
  const riskText = lvl => (lvl === 'high' ? t('risk.high') : t('risk.low'));

  function renderItem(it, rerender) {
    const name = t('f.' + it.id + '.name'), desc = t('f.' + it.id + '.desc'), tip = t('f.' + it.id + '.tip');
    const tipFull = (tip === 'f.' + it.id + '.tip' ? '' : tip) + (it.risk ? (tip === 'f.' + it.id + '.tip' ? '' : '\n\n') + '⚠ ' + riskText(it.risk) : '');
    const txt = el('div', { class: 'txt', title: tipFull || null },
      el('div', { class: 'n' }, name, it.risk ? el('span', { class: 'wat-risk', title: '⚠ ' + riskText(it.risk) }, it.risk === 'high' ? '⛔' : '⚠️') : null),
      desc && desc !== 'f.' + it.id + '.desc' ? el('div', { class: 'd' }, desc) : null);
    let ctl;
    const v = it.getValue ? it.getValue() : WAT.get(it.id);
    switch (it.type) {
      case 'toggle':
        ctl = el('button', { class: 'wat-sw', role: 'switch', 'aria-checked': String(!!v), title: tipFull || null, onclick: e => { const nv = !WAT.on(it.id); WAT.set(it.id, nv); e.currentTarget.setAttribute('aria-checked', String(nv)); if (it.rerender) rerender(); } });
        break;
      case 'number':
        ctl = el('input', { class: 'wat-in', type: 'number', min: it.min, max: it.max, value: v, style: 'width:90px', onchange: e => WAT.set(it.id, Math.min(it.max, Math.max(it.min, Number(e.target.value) || it.def))) });
        break;
      case 'text':
        ctl = el('input', { class: 'wat-in', value: v || '', placeholder: it.placeholder || '', style: 'width:' + (it.width || 220) + 'px', onchange: e => WAT.set(it.id, e.target.value.trim()) });
        break;
      case 'select':
        ctl = el('select', { class: 'wat-in', onchange: e => { if (it.onSet) it.onSet(e.target.value); else WAT.set(it.id, e.target.value); if (it.rerender) rerender(); } },
          (typeof it.options === 'function' ? it.options() : it.options).map(o => { const op = el('option', { value: o.v }, o.label || t(o.key)); if (String(o.v) === String(v)) op.selected = true; return op; }));
        break;
      case 'color': {
        const c = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v) ? v : '#202c33', oninput: e => WAT.set(it.id, e.target.value) });
        ctl = el('div', { style: 'display:flex;gap:6px;align-items:center' }, c, el('button', { class: 'wat-btn', onclick: () => { WAT.set(it.id, ''); rerender(); } }, t('ui.reset')));
        break;
      }
      case 'shortcut':
        ctl = el('input', {
          class: 'wat-in', readonly: true, style: 'width:170px', value: v || t('ui.noShortcut'), title: t('ui.shortcutHint'),
          onkeydown: e => {
            e.preventDefault(); e.stopPropagation();
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
            if (e.key === 'Delete' || e.key === 'Backspace') { WAT.set(it.id, ''); e.target.value = t('ui.noShortcut'); return; }
            const parts = []; if (e.ctrlKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift');
            if (!parts.length) return;
            parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key); const s = parts.join('+'); WAT.set(it.id, s); e.target.value = s;
          },
        });
        break;
      case 'action':
        ctl = el('button', { class: 'wat-btn ' + (it.danger ? 'dang' : ''), title: tipFull || null, onclick: async e => { try { await it.run({ rerender, close: closePanel, btn: e.currentTarget }); } catch (err) { WAT.toast(t('ui.error'), String(err && err.message || err), 'err'); } } }, t('a.' + it.id));
        break;
      case 'textarea':
        ctl = el('textarea', { class: 'wat-in', spellcheck: 'false', placeholder: it.placeholder || '', oninput: e => WAT.set(it.id, e.target.value) }); ctl.value = v || '';
        return el('div', { class: 'wat-row wat-col' }, txt, ctl);
      case 'chats': {
        const n = Array.isArray(v) ? v.length : 0;
        ctl = el('button', { class: 'wat-btn', onclick: async () => { await pickChats(it.id); rerender(); } }, t('ui.pick', { n }));
        break;
      }
      case 'info':
        return el('div', { class: 'wat-hint', style: 'white-space:pre-wrap' }, desc);
      default: ctl = el('span');
    }
    return el('div', { class: 'wat-row' }, txt, ctl);
  }

  async function pickChats(id) {
    let chats = [];
    try { const C = WAT.req('WAWebChatCollection').ChatCollection; chats = (C.getModelsArray ? C.getModelsArray() : C.models).filter(c => c && c.id && !String(c.id._serialized || c.id).includes('status@') && !String(c.id._serialized || c.id).includes('@newsletter')); } catch {}
    const sel = new Set(WAT.get(id) || []);
    const rows = chats.map(c => ({ id: String(c.id._serialized || c.id), name: c.formattedTitle || c.name || String(c.id).split('@')[0] })).sort((a, b) => a.name.localeCompare(b.name));
    return dialog((p, done) => {
      const filter = el('input', { class: 'wat-in', placeholder: t('ui.search'), style: 'width:100%;box-sizing:border-box;margin:8px 0' });
      const list = el('div', { style: 'max-height:46vh;overflow:auto' });
      const draw = () => {
        list.replaceChildren(); const q = filter.value.trim().toLowerCase();
        for (const r of rows.filter(x => !q || x.name.toLowerCase().includes(q)).slice(0, 300)) {
          const cb = el('input', { type: 'checkbox' }); cb.checked = sel.has(r.id);
          cb.onchange = () => (cb.checked ? sel.add(r.id) : sel.delete(r.id));
          list.append(el('label', { style: 'display:flex;gap:8px;align-items:center;padding:4px 0;cursor:pointer' }, cb, r.name));
        }
      };
      filter.oninput = draw; draw();
      p.style.width = 'min(480px,92vw)';
      p.append(el('h2', { style: 'margin:0;font-size:17px' }, t('ui.pickTitle')), filter, list,
        el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px' },
          el('button', { class: 'wat-btn', onclick: () => done(null) }, t('ui.cancel')),
          el('button', { class: 'wat-btn pri', onclick: () => { WAT.set(id, [...sel]); done(true); } }, t('ui.ok'))));
    });
  }

  function closePanel() { if (ovEl) { ovEl.remove(); ovEl = null; } document.removeEventListener('keydown', escHandler, true); }
  const escHandler = e => {
    if (e.key !== 'Escape' || !ovEl) return;
    e.stopPropagation();
    const s = ovEl.__search;
    if (s && s.value) { s.value = ''; s.dispatchEvent(new Event('input')); return; }   // first Esc clears the search
    closePanel();
  };

  // lower-case, accent-insensitive text for the option search
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const known = k => { const v = t(k); return v === k ? '' : v; };   // t() echoes the key when a string is missing

  WAT.openSettings = section => {
    closePanel();
    curSection = section || curSection || (WAT.sections[0] && WAT.sections[0].id);
    ovEl = el('div', { class: 'wat-ov' });
    const nav = el('div', { class: 'wat-nav' });
    const body = el('div', { class: 'wat-body' });
    const title = el('div', { class: 't' });
    const search = el('input', { class: 'wat-in wat-q', type: 'search', spellcheck: 'false', oninput: () => { draw(); body.scrollTop = 0; } });
    // every typed word must appear in the section name, the option's name/description/tip or its id
    const matches = (sec, it, words) => {
      const hay = norm([known('s.' + sec.id), known('f.' + it.id + '.name'), known('f.' + it.id + '.desc'), known('f.' + it.id + '.tip'), known('a.' + it.id), it.id].join(' '));
      return words.every(w => hay.includes(w));
    };
    const draw = () => {
      const words = norm(search.value).split(/\s+/).filter(Boolean);
      const searching = words.length > 0;
      search.placeholder = t('ui.searchOptions');
      nav.replaceChildren(el('h2', {}, 'WaDesktop-Tweaks'));
      for (const s of WAT.sections) {
        nav.append(el('button', {
          'aria-current': String(!searching && s.id === curSection),
          onclick: () => { curSection = s.id; search.value = ''; draw(); body.scrollTop = 0; },
        }, t('s.' + s.id)));
      }
      body.replaceChildren();
      if (searching) {
        title.textContent = t('ui.search');
        let found = 0;
        for (const s of WAT.sections) {
          const hits = s.items.filter(it => matches(s, it, words));
          if (!hits.length) continue;
          found += hits.length;
          body.append(el('div', { class: 'wat-sechead' }, t('s.' + s.id)));
          for (const it of hits) body.append(renderItem(it, draw));
        }
        if (!found) body.append(el('div', { class: 'wat-hint' }, t('ui.noResults')));
      } else {
        const sec = WAT.sections.find(s => s.id === curSection) || WAT.sections[0];
        title.textContent = t('s.' + sec.id);
        if (t('sd.' + sec.id) !== 'sd.' + sec.id) body.append(el('div', { class: 'wat-hint' }, t('sd.' + sec.id)));
        for (const it of sec.items) { if (it.showIf && !it.showIf()) continue; body.append(renderItem(it, draw)); }
      }
    };
    draw();
    body.scrollTop = 0;
    ovEl.__search = search;
    ovEl.append(el('div', { class: 'wat-panel' }, nav, el('div', { class: 'wat-main' },
      el('div', { class: 'wat-head' }, title, search, el('button', { class: 'wat-x', title: t('ui.close'), onclick: closePanel }, '✕')), body)));
    ovEl.addEventListener('mousedown', e => { if (e.target === ovEl) closePanel(); });
    document.body.appendChild(ovEl); document.addEventListener('keydown', escHandler, true);
    WAT.__redraw = draw;
    setTimeout(() => search.focus(), 30);
  };
  WAT.onEvent('change', id => { if (ovEl && WAT.__redraw && (id === 'language' || id === '*')) WAT.__redraw(); });

  /* ---------- header buttons (gear + quick actions) ---------- */
  const build = () => {
    if (window.__watUIBuilt) return; window.__watUIBuilt = true;
    document.documentElement.appendChild(el('style', { id: 'wat-style' }, CSS));
    const gear = el('button', { class: 'wat-gear', title: 'WaDesktop-Tweaks', onclick: () => WAT.openSettings() }, '⚙');
    const act = el('div', { class: 'wat-act' });
    document.body.append(gear, act);
    WAT.__gear = gear; WAT.__act = act;
  };

  let lastLoaded = 0;
  setInterval(() => {
    if (WAT.nowReady() && !window.__watUIBuilt) build();
    const gear = WAT.__gear, act = WAT.__act; if (!gear || !act) return;
    const rows = document.querySelector('#pane-side [role="row"]');
    const ready = !!rows; if (ready && !lastLoaded) lastLoaded = Date.now();
    let covered = false;
    if (ready) {
      // Gear goes immediately left of the leftmost button in the chat-list header (language independent).
      let x = 330, y = 56, anchor = null;
      const cands = [...document.querySelectorAll('header button, header [role="button"]')].map(e => ({ e, r: e.getBoundingClientRect() }))
        .filter(c => c.r.width > 0 && c.r.top < 150 && c.r.left > 150 && c.r.left < 700);
      if (cands.length) {
        anchor = cands.reduce((m, c) => (c.r.left < m.r.left ? c : m), cands[0]);
        x = anchor.r.left - 44; y = anchor.r.top + (anchor.r.height - 36) / 2;
      }
      gear.style.left = x + 'px'; gear.style.top = y + 'px';
      // If a full-screen layer (status viewer, media viewer, a dialog) covers that header button, hide our buttons too.
      if (anchor) {
        gear.style.pointerEvents = 'none'; act.style.pointerEvents = 'none';
        const hit = document.elementFromPoint(anchor.r.left + anchor.r.width / 2, anchor.r.top + anchor.r.height / 2);
        gear.style.pointerEvents = ''; act.style.pointerEvents = '';
        covered = !!hit && !anchor.e.contains(hit) && !hit.contains(anchor.e);
      }
    }
    gear.style.display = ready && !covered ? 'block' : 'none';
    // quick actions inside an open chat
    const inChat = !!document.querySelector('footer');
    if (WAT.__actDirty || act.__n !== (WAT.actions || []).length) {
      act.replaceChildren(...(WAT.actions || []).map(a => { const b = el('button', { class: 'wat-btn', onclick: a.fn }, a.label); b.__a = a; return b; }));
      act.__n = (WAT.actions || []).length; WAT.__actDirty = false;
    }
    for (const b of act.children) { b.title = t(b.__a.titleKey); b.style.display = b.__a.showIf && !b.__a.showIf() ? 'none' : ''; }
    act.style.display = ready && !covered && inChat && (WAT.actions || []).length ? 'flex' : 'none';
  }, 250);

  /* ---------- global keyboard shortcuts ---------- */
  const combo = e => { const p = []; if (e.ctrlKey) p.push('Ctrl'); if (e.altKey) p.push('Alt'); if (e.shiftKey) p.push('Shift'); if (!p.length) return ''; p.push(e.key.length === 1 ? e.key.toUpperCase() : e.key); return p.join('+'); };
  window.addEventListener('keydown', e => {
    if (WAT.__locked) return;
    const c = combo(e); if (!c) return;
    for (const [id, fn] of Object.entries(WAT.shortcuts)) if (WAT.get(id) === c) { e.preventDefault(); e.stopPropagation(); fn(); return; }
  }, true);
})();
