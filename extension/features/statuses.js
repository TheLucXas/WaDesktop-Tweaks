/* Statuses (stories): optional local archive of other people's statuses, including ones deleted early.
 * Off by default. Stores text + thumbnail; full media only if you enable it, with a size cap. */
(() => {
  const WAT = window.WAT; if (!WAT) return;
  const { t, el } = WAT;

  WAT.section('statuses', [
    { id: 'trackStatuses', type: 'toggle', def: false, risk: 'low' },
    { id: 'statusMode', type: 'select', def: 'all', rerender: true, showIf: () => WAT.on('trackStatuses'),
      options: [{ v: 'all', key: 'status.modeAll' }, { v: 'only', key: 'status.modeOnly' }, { v: 'except', key: 'status.modeExcept' }] },
    { id: 'statusContacts', type: 'chats', def: [], showIf: () => WAT.on('trackStatuses') && WAT.get('statusMode') !== 'all' },
    { id: 'statusMedia', type: 'toggle', def: false, risk: 'low', showIf: () => WAT.on('trackStatuses') },
    { id: 'statusMaxMB', type: 'number', def: 200, min: 10, max: 5000, showIf: () => WAT.on('trackStatuses') && WAT.on('statusMedia') },
    { id: 'statusDays', type: 'number', def: 7, min: 1, max: 90, showIf: () => WAT.on('trackStatuses') },
    { id: 'openStatuses', type: 'action', run: () => openViewer() },
    { id: 'clearStatuses', type: 'action', danger: true, run: async () => {
      if (await WAT.confirm(t('f.clearStatuses.name'), t('f.clearStatuses.confirm'), t('a.clearStatuses'), true)) { await WAT.db.clear('statuses'); WAT.toast(t('ui.done')); }
    } },
  ], 30);

  const seen = new Set();
  const keyOf = m => m && m.id && (m.id._serialized || String(m.id));
  const origKeyOf = m => { try { const k = m && m.protocolMessageKey; return k && (k._serialized || String(k)); } catch { return null; } };
  const allowed = author => {
    const mode = WAT.get('statusMode'); if (mode === 'all') return true;
    const list = WAT.get('statusContacts') || [];
    const inList = list.some(id => String(id) === String(author));
    return mode === 'only' ? inList : !inList;
  };
  const authorOf = m => String((m.author && (m.author._serialized || m.author)) || (m.id && m.id.participant && (m.id.participant._serialized || m.id.participant)) || m.from || '');

  async function usedBytes() { const all = await WAT.db.all('statuses'); return all.reduce((s, r) => s + (r.blob ? r.blob.size : 0), 0); }

  async function save(m) {
    try {
      if (!WAT.on('trackStatuses') || !m || !m.id || m.id.fromMe) return;
      if (!String(m.id.remote || '').includes('status@broadcast')) return;
      const key = keyOf(m); if (!key || seen.has(key)) return;
      const author = authorOf(m); if (!allowed(author)) return;
      if (['revoked', 'protocol', 'ciphertext'].includes(m.type)) return;
      seen.add(key);
      let name = ''; try { name = (m.senderObj && (m.senderObj.formattedName || m.senderObj.pushname)) || m.notifyName || ''; } catch {}
      const rec = {
        id: key, author, name: name || author.split('@')[0], type: m.type, ts: (m.t || 0) * 1000, savedAt: Date.now(),
        text: typeof m.body === 'string' && m.type === 'chat' ? m.body : (m.caption || ''),
        thumb: m.type !== 'chat' && typeof m.body === 'string' && m.body.length > 80 && m.body.length < 80000 ? m.body : '',
        mime: m.mimetype || '', deleted: false, blob: null,
      };
      await WAT.db.put('statuses', rec);
      if (WAT.on('statusMedia') && ['image', 'video'].includes(m.type)) {
        try {
          const cap = (Number(WAT.get('statusMaxMB')) || 200) * 1048576;
          if ((await usedBytes()) < cap) {
            try { await m.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1, isUserInitiated: false }); } catch { await m.downloadMedia(); }
            const od = m.mediaData && m.mediaData.mediaBlob;
            if (od) {
              const buf = await WAT.req('WAWebMediaDataUtils').opaqueDataToArrayBuffer(od);
              if (buf && (await usedBytes()) + buf.byteLength < cap) { rec.blob = new Blob([buf], { type: m.mimetype || (m.type === 'video' ? 'video/mp4' : 'image/jpeg') }); await WAT.db.put('statuses', rec); }
            }
          }
        } catch (e) { WAT.log('status media: ' + e); }
      }
    } catch (e) { WAT.log('status save: ' + e); }
  }

  async function onRevoked(m) {
    try {
      if (!m || m.type !== 'revoked') return;
      const orig = origKeyOf(m); if (!orig) return;
      const rec = await WAT.db.get('statuses', orig); if (!rec || rec.deleted) return;
      rec.deleted = true; rec.deletedAt = Number(m.revokeTimestamp) ? Number(m.revokeTimestamp) * 1000 : Date.now();
      await WAT.db.put('statuses', rec);
      if (Date.now() - rec.deletedAt < 120000) WAT.toast(t('status.deletedBy', { who: rec.name }), WAT.safeText(rec.text) || '[' + rec.type + ']', 'warn');
    } catch {}
  }

  let wired = false;
  setInterval(() => {
    if (!WAT.on('trackStatuses')) return;
    if (!wired) {
      let M; try { M = WAT.req('WAWebCollections').Msg; } catch {}
      if (!M || typeof M.on !== 'function') return;
      wired = true;
      M.on('add', m => { if (m && m.type === 'revoked') onRevoked(m); else save(m); });
      M.on('change:type', m => { if (m && m.type === 'revoked') onRevoked(m); });
      M.on('change:body', m => save(m));
    }
    // catch statuses already loaded + purge old ones occasionally
    for (const m of WAT.msgs()) if (m && String(m.id && m.id.remote || '').includes('status@broadcast')) save(m);
  }, 5000);
  setInterval(async () => {
    try {
      const cutoff = Date.now() - (Number(WAT.get('statusDays')) || 7) * 86400e3;
      (await WAT.db.all('statuses')).filter(r => r.savedAt < cutoff).forEach(r => WAT.db.del('statuses', r.id));
    } catch {}
  }, 60 * 60 * 1000);

  async function openViewer() {
    const all = (await WAT.db.all('statuses')).sort((a, b) => b.ts - a.ts);
    const ov = el('div', { class: 'wat-ov' });
    const panel = el('div', { class: 'wat-panel', style: 'display:block;padding:16px 18px;overflow:auto' });
    const urls = [];
    const close = () => { urls.forEach(u => URL.revokeObjectURL(u)); ov.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc, true);
    const fmt = x => new Date(x).toLocaleString();
    const list = el('div', { class: 'wat-list' });
    if (!all.length) list.append(el('div', { class: 'wat-hint' }, t('status.none')));
    for (const r of all) {
      const it = el('div', { class: 'it' }, el('div', { class: 'h' }, r.name + ' — ' + fmt(r.ts) + (r.deleted ? ' — ' + t('msg.deletedAt') + ' ' + fmt(r.deletedAt) : '')));
      if (r.text) it.append(el('div', { class: 'b' }, WAT.safeText(r.text)));
      if (r.blob) {
        const u = URL.createObjectURL(r.blob); urls.push(u);
        const media = r.blob.type.startsWith('video') ? el('video', { src: u, controls: true, style: 'max-width:260px;border-radius:8px;display:block;margin-top:6px' }) : el('img', { src: u });
        it.append(media, el('button', { class: 'wat-btn', style: 'margin-top:6px', onclick: () => { const a = el('a', { href: u, download: 'status-' + r.ts + '.' + (r.blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg') }); document.body.appendChild(a); a.click(); a.remove(); } }, t('ui.save')));
      } else if (r.thumb) it.append(el('img', { src: 'data:image/jpeg;base64,' + r.thumb }));
      list.append(it);
    }
    panel.append(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, el('h2', { style: 'margin:0;font-size:17px' }, t('f.openStatuses.name')), el('button', { class: 'wat-x', onclick: close }, '✕')),
      el('div', { class: 'wat-hint' }, t('status.viewerHint')), list);
    ov.append(panel); document.body.appendChild(ov); ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  }
})();
