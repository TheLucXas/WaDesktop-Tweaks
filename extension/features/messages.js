/* Messages: local copy of incoming messages -> recover "deleted for everyone" text, keep edit history.
 * Everything is stored in this PC's IndexedDB. Nothing is sent anywhere, and WhatsApp itself is not modified:
 * the recovered text is only painted over the "This message was deleted" bubble on your screen. */
(() => {
  const WAT = window.WAT; if (!WAT) return;
  const { t, el } = WAT;

  WAT.section('messages', [
    { id: 'trackDeleted', type: 'toggle', def: false, risk: 'low' },
    { id: 'trackHours', type: 'number', def: 72, min: 1, max: 720, showIf: () => WAT.on('trackDeleted') },
    { id: 'trackToast', type: 'toggle', def: true, showIf: () => WAT.on('trackDeleted') },
    { id: 'showDeletedInline', type: 'toggle', def: true, showIf: () => WAT.on('trackDeleted') },
    { id: 'trackEdits', type: 'toggle', def: true, showIf: () => WAT.on('trackDeleted') },
    { id: 'openDeleted', type: 'action', run: () => openViewer() },
    { id: 'clearTracker', type: 'action', danger: true, run: async ({ btn }) => {
      if (await WAT.confirm(t('f.clearTracker.name'), t('f.clearTracker.confirm'), t('a.clearTracker'), true)) { await WAT.db.clear('msgs'); cache.clear(); delIndex.clear(); WAT.toast(t('ui.done')); }
    } },
  ], 20);

  const cache = new Map();      // original key -> record (synchronous access)
  const delIndex = new Map();   // original key -> deleted record
  const checked = new Set();
  const keyOf = m => m && m.id && (m.id._serialized || String(m.id));
  const origKeyOf = m => {
    try {
      const k = m && m.protocolMessageKey; if (!k) return null;
      return k._serialized || (k.remote && k.id ? (k.fromMe ? 'true' : 'false') + '_' + (k.remote._serialized || k.remote) + '_' + k.id : String(k));
    } catch { return null; }
  };
  const IGNORED_TYPES = ['revoked', 'protocol', 'e2e_notification', 'notification_template', 'gp2', 'call_log', 'ciphertext', 'broadcast_notification'];

  function names(m) {
    let chat = null; try { chat = WAT.req('WAWebChatCollection').ChatCollection.get(m.id.remote); } catch {}
    const chatName = (chat && (chat.formattedTitle || chat.name)) || String(m.id.remote || '').split('@')[0];
    let sender = '';
    try { sender = (m.senderObj && (m.senderObj.formattedName || m.senderObj.pushname)) || m.notifyName || String(m.author || m.from || '').split('@')[0]; } catch {}
    return { chatName, sender };
  }
  function toRecord(m) {
    if (!m || !m.id || m.isViewOnce) return null;                           // view-once content is never stored
    const own = !!m.id.fromMe;                                               // own messages: kept in memory, saved only once edited
    const ty = m.type; if (!ty || IGNORED_TYPES.includes(ty)) return null;
    const remote = String(m.id.remote || ''); if (remote.includes('status@') || remote.includes('@newsletter')) return null;
    const text = typeof m.body === 'string' && (ty === 'chat' || ty === 'conversation') ? m.body : (m.caption || '');
    const thumb = ty !== 'chat' && typeof m.body === 'string' && m.body.length > 80 && m.body.length < 60000 ? m.body : '';
    if (!text && !thumb && ty === 'chat') return null;
    const n = names(m);
    return { id: keyOf(m), chat: n.chatName, sender: own ? t('ui.me') : n.sender, own, type: ty, text, thumb, mime: m.mimetype || '', ts: (m.t || 0) * 1000, savedAt: Date.now(), deleted: false, edits: [] };
  }

  function remember(m) {
    try {
      if (!WAT.on('trackDeleted')) return;
      const rec = toRecord(m); if (!rec) return;
      const prev = cache.get(rec.id);
      if (prev) {
        if (prev.deleted) return;
        // Edit detection: same message id, different text.
        if (WAT.on('trackEdits') && prev.text && rec.text && prev.text !== rec.text && m.type === 'chat') {
          prev.edits = prev.edits || []; prev.edits.push({ text: prev.text, at: Date.now() });
          prev.text = rec.text; WAT.db.put('msgs', prev).catch(() => {}); return;
        }
        if (prev.text === rec.text) return;
      }
      cache.set(rec.id, rec);
      if (cache.size > 4000) cache.delete(cache.keys().next().value);
      if (!rec.own) WAT.db.put('msgs', rec).catch(() => {});
    } catch (e) { WAT.log('remember: ' + e); }
  }

  async function onRevoked(m) {
    try {
      if (!m || !m.id || m.type !== 'revoked') return;
      // WhatsApp replaces the message id with the revoke notice's id; the original lives in protocolMessageKey.
      const own = keyOf(m), orig = origKeyOf(m), tag = orig || own;
      if (!tag || checked.has(tag)) return;
      const rec = (orig && (cache.get(orig) || await WAT.db.get('msgs', orig))) || cache.get(own) || await WAT.db.get('msgs', own);
      checked.add(tag);
      if (!rec || rec.deleted || rec.own) return;
      rec.deleted = true; rec.deletedAt = Number(m.revokeTimestamp) ? Number(m.revokeTimestamp) * 1000 : Date.now();
      cache.set(rec.id, rec); delIndex.set(rec.id, rec); await WAT.db.put('msgs', rec);
      if (WAT.on('trackToast') && Date.now() - rec.deletedAt < 120000) WAT.toast(t('msg.deletedBy', { who: rec.sender || rec.chat }), WAT.safeText(rec.text) || '[' + rec.type + ']', 'warn');
    } catch (e) { WAT.log('onRevoked: ' + e); }
  }

  let wired = false;
  function wire() {
    if (wired) return true;
    let M; try { M = WAT.req('WAWebCollections').Msg; } catch {}
    if (!M || typeof M.on !== 'function') return false;
    wired = true;
    M.on('add', m => { if (m && m.type === 'revoked') onRevoked(m); else remember(m); });
    M.on('change:type', m => { if (m && m.type === 'revoked') onRevoked(m); else remember(m); });
    M.on('change:body', m => { if (m && m.type !== 'revoked') remember(m); });
    M.on('change', m => {
      try { const k = Object.keys(m.changed || {}).filter(x => /edit|body|latest/i.test(x)); if (k.length) WAT.log('msg change: ' + k.join(',') + ' type=' + m.type + ' own=' + !!(m.id && m.id.fromMe)); } catch {}
    });
    setTimeout(() => WAT.msgs().forEach(m => { const r = toRecord(m); if (r && r.ts > Date.now() - 72 * 3600e3 && WAT.on('trackDeleted')) remember(m); }), 3000);
    return true;
  }
  let lastDel = 0, lastPurge = 0;
  const loadDeleted = async () => { try { (await WAT.db.all('msgs')).forEach(r => { if (r.deleted) delIndex.set(r.id, r); if (r.edits && r.edits.length && !cache.has(r.id)) cache.set(r.id, r); }); } catch {} };

  /* periodic work: wiring, backup sweep for revoked models, purge */
  setInterval(() => {
    if (!wired && !wire()) return;
    if (Date.now() - lastDel > 8000) { lastDel = Date.now(); loadDeleted(); }
    if (WAT.on('trackDeleted')) for (const m of WAT.msgs()) if (m && m.type === 'revoked') { const k = origKeyOf(m) || keyOf(m); if (k && !checked.has(k)) onRevoked(m); }
    if (Date.now() - lastPurge > 30 * 60 * 1000) {
      lastPurge = Date.now();
      const cutoff = Date.now() - Math.max(1, Number(WAT.get('trackHours')) || 72) * 3600e3;
      WAT.db.all('msgs').then(all => all.filter(r => !r.deleted && !(r.edits && r.edits.length) && r.savedAt < cutoff).forEach(r => { WAT.db.del('msgs', r.id); cache.delete(r.id); })).catch(() => {});
    }
  }, 2000);

  /* ---------- paint recovered text / edit marks on the chat ---------- */
  const metaSel = '[data-testid="msg-meta"]';
  const ENDS_WITH_TIME = /\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?\s?m\.?)?\s*$/i;

  // Click on ✏️: the previous versions of one message, oldest first, then the current text.
  function showEdits(rec) {
    const ov = el('div', { class: 'wat-ov' });
    const close = () => ov.remove();
    const when = ms => { try { return new Date(ms).toLocaleString(); } catch { return ''; } };
    const list = el('div', { class: 'wat-list' });
    (rec.edits || []).forEach((e, i) => list.append(el('div', { class: 'it' },
      el('div', { class: 'h' }, (i + 1) + (e.at ? ' · ' + when(e.at) : '')), el('div', { class: 'b' }, WAT.safeText(e.text)))));
    list.append(el('div', { class: 'it' }, el('div', { class: 'h' }, t('msg.current')), el('div', { class: 'b' }, WAT.safeText(rec.text || ''))));
    ov.append(el('div', { class: 'wat-panel', style: 'display:block;width:min(520px,94vw);height:auto;max-height:80vh;overflow:auto;padding:16px 18px' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
        el('h2', { style: 'margin:0;font-size:17px' }, '✏️ ' + t('msg.editedTip')), el('button', { class: 'wat-x', onclick: close }, '✕')),
      list));
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
  }
  function paintRow(row, idx) {
    const msg = idx.get(row.getAttribute('data-id')); if (!msg) return;
    if (msg.type === 'revoked' && WAT.on('showDeletedInline')) {
      const orig = origKeyOf(msg); const rec = (orig && delIndex.get(orig)) || delIndex.get(keyOf(msg));
      if (!rec) return;
      const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const p = n.parentElement; if (!p || p.closest(metaSel) || p.closest('svg') || p.tagName === 'TITLE' || !n.nodeValue.trim()) continue;
        if (p.dataset.watDel) break;
        n.nodeValue = WAT.safeText(rec.text) || '[' + (rec.type || '') + ']';
        p.dataset.watDel = '1'; p.title = t('msg.deletedTip'); p.style.whiteSpace = 'pre-wrap'; p.style.overflowWrap = 'anywhere'; p.style.color = '#ff9b9b';
        break;
      }
      return;
    }
    if (WAT.on('trackEdits') && WAT.on('trackDeleted')) {
      const rec = cache.get(keyOf(msg));
      if (rec && rec.edits && rec.edits.length) {
        const meta = row.querySelector(metaSel); if (!meta) return;
        let mark = row.querySelector('.wat-edit');
        const tip = t('msg.editedTip') + '\n\n' + rec.edits.map((e, i) => (i + 1) + '. ' + WAT.safeText(e.text)).join('\n');
        if (!mark) {
          mark = el('span', { class: 'wat-edit', style: 'margin:0 3px;cursor:pointer;font-size:12px' }, '✏️');
          const key = keyOf(msg);
          mark.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const r = cache.get(key); if (r) showEdits(r); });
          // Placed right after the text, in front of WhatsApp's invisible copy of the time: it takes part in the text
          // line like any word, so nothing is covered. Inside the time block it would sit on top of the message.
          // The copy of an edited message also carries the word "Edited", so it only has to END with a time.
          const copy = [...row.querySelectorAll('span[aria-hidden="true"]')].find(s => !meta.contains(s) && s.textContent.length < 60 && ENDS_WITH_TIME.test(s.textContent));
          const holder = copy && copy.parentElement;
          const text = row.querySelector('[data-testid="selectable-text"], .selectable-text');
          if (holder && holder.parentElement) holder.parentElement.insertBefore(mark, holder);
          else if (text && text.parentElement) text.parentElement.insertBefore(mark, text.nextSibling);
          else meta.prepend(mark);
        }
        mark.title = tip;
      }
    }
  }
  setInterval(() => {
    try {
      if (!WAT.on('showDeletedInline') && !WAT.on('trackEdits')) return;
      const rows = document.querySelectorAll('[data-id]'); if (!rows.length) return;
      const idx = new Map();
      const chat = WAT.activeChat(); const arr = chat && chat.msgs && (chat.msgs.getModelsArray ? chat.msgs.getModelsArray() : chat.msgs.models);
      if (arr) for (const m of arr) if (m && m.id && m.id.id) idx.set(m.id.id, m);
      rows.forEach(r => paintRow(r, idx));
    } catch {}
  }, 300);
  WAT.msgIndex = () => {
    const idx = new Map();
    try { const chat = WAT.activeChat(); const arr = chat && chat.msgs && (chat.msgs.getModelsArray ? chat.msgs.getModelsArray() : chat.msgs.models); if (arr) for (const m of arr) if (m && m.id && m.id.id) idx.set(m.id.id, m); } catch {}
    return idx;
  };

  /* ---------- viewer ---------- */
  async function openViewer() {
    const all = (await WAT.db.all('msgs')).sort((a, b) => (b.deletedAt || b.savedAt) - (a.deletedAt || a.savedAt));
    let tab = 'deleted';
    const ov = el('div', { class: 'wat-ov' });
    const panel = el('div', { class: 'wat-panel', style: 'display:block;padding:16px 18px;overflow:auto' });
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc, true);
    const q = el('input', { class: 'wat-in', placeholder: t('ui.search'), style: 'flex:1' });
    const list = el('div', { class: 'wat-list' });
    const fmt = x => new Date(x).toLocaleString();
    const rowsFor = () => {
      const term = q.value.trim().toLowerCase();
      return all.filter(r => (tab === 'deleted' ? r.deleted : r.edits && r.edits.length))
        .filter(r => !term || ((r.text || '') + ' ' + (r.sender || '') + ' ' + (r.chat || '') + ' ' + (r.edits || []).map(e => e.text).join(' ')).toLowerCase().includes(term));
    };
    const draw = () => {
      list.replaceChildren(); const rows = rowsFor();
      if (!rows.length) list.append(el('div', { class: 'wat-hint' }, t('msg.none')));
      for (const r of rows) {
        const it = el('div', { class: 'it' }, el('div', { class: 'h' }, (r.sender || r.chat) + (r.sender && r.chat !== r.sender ? ' · ' + r.chat : '') + ' — ' + t('msg.sent') + ' ' + fmt(r.ts) + (r.deleted ? ' — ' + t('msg.deletedAt') + ' ' + fmt(r.deletedAt) : '')));
        if (tab === 'edited') {
          (r.edits || []).forEach((e, i) => it.append(el('div', { class: 'b' }, '#' + (i + 1) + ' (' + fmt(e.at) + '): ' + WAT.safeText(e.text))));
          it.append(el('div', { class: 'b', style: 'color:var(--teal,#00a884)' }, t('msg.current') + ': ' + WAT.safeText(r.text)));
        } else it.append(el('div', { class: 'b' }, WAT.safeText(r.text) || '[' + r.type + (r.mime ? ' ' + r.mime : '') + ']'));
        if (r.thumb) it.append(el('img', { src: 'data:image/jpeg;base64,' + r.thumb }));
        list.append(it);
      }
    };
    const tabBtn = (id, label) => el('button', { class: 'wat-btn', 'aria-pressed': String(tab === id), onclick: e => { tab = id; tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); draw(); } }, label);
    const tabs = el('div', { class: 'wat-tabs' }, tabBtn('deleted', t('msg.tabDeleted')), tabBtn('edited', t('msg.tabEdited')));
    tabs.firstChild.setAttribute('aria-pressed', 'true');
    q.oninput = draw;
    const exp = el('button', { class: 'wat-btn', onclick: () => {
      const NL = String.fromCharCode(10);
      WAT.download('wa-messages-' + tab + '.txt', rowsFor().map(r => '[' + fmt(r.ts) + '] ' + (r.sender || r.chat) + (r.deleted ? ' (' + t('msg.deletedAt') + ' ' + fmt(r.deletedAt) + ')' : '') + NL + (tab === 'edited' ? (r.edits || []).map(e => ' - ' + e.text).join(NL) + NL + ' = ' + r.text : r.text || '[' + r.type + ']') + NL).join(NL));
    } }, t('ui.export'));
    panel.append(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, el('h2', { style: 'margin:0;font-size:17px' }, t('f.openDeleted.name')), el('button', { class: 'wat-x', onclick: close }, '✕')),
      el('div', { class: 'wat-hint' }, t('msg.viewerHint')), tabs, el('div', { style: 'display:flex;gap:8px;margin:6px 0' }, q, exp), list);
    ov.append(panel); document.body.appendChild(ov); ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    draw();
  }
})();
