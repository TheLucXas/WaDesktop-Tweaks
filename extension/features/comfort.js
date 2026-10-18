/* Comfort: sticker confirmation, double-click reactions, seconds in timestamps, save-media button,
 * hide "forwarded" label, quick replies, keyword highlight, chat export. */
(() => {
  const WAT = window.WAT; if (!WAT) return;
  const { t, el } = WAT;

  WAT.section('comfort', [
    { id: 'confirmSticker', type: 'toggle', def: false },
    { id: 'dblReact', type: 'toggle', def: false, rerender: true },
    { id: 'dblEmoji', type: 'text', def: '👍', width: 70, showIf: () => WAT.on('dblReact') },
    { id: 'timeSeconds', type: 'toggle', def: false },
    { id: 'saveMedia', type: 'toggle', def: false },
    { id: 'dedupeNotif', type: 'toggle', def: true },
    { id: 'hideForwarded', type: 'toggle', def: false },
    { id: 'quickReplies', type: 'textarea', def: '', placeholder: 'thanks = Thank you!\nbrb = Be right back' },
    { id: 'quickReplyShortcut', type: 'shortcut', def: 'Ctrl+Alt+Q' },
    { id: 'highlightWords', type: 'textarea', def: '', placeholder: 'urgent\nmeeting' },
    { id: 'highlightColor', type: 'color', def: '#f5a623' },
    { id: 'exportTxt', type: 'action', run: ({ btn }) => exportChat(btn, 'txt') },
    { id: 'exportJson', type: 'action', run: ({ btn }) => exportChat(btn, 'json') },
  ], 50);

  /* ---------- no repeated notifications ----------
   * While the window is hidden WhatsApp's connection drops and resumes every few minutes, and each time it
   * re-shows a toast for the latest unread message (log: "show lastest unread msg due to offline delivery end").
   * Same message + same text shown again = a repeat: skipped. A new message or an edit has a different signature.
   * Fail-open: anything unexpected lets the original notification through. */
  const seenNotif = new Map(); let notifPatched = false;
  setInterval(() => {
    if (notifPatched) return;
    try {
      const H = WAT.req('WAWebWindowsNotificationHelpers');
      if (!H || typeof H.showMessageNotification !== 'function' || H.showMessageNotification.__watDedupe) return;
      const orig = H.showMessageNotification;
      const wrapped = function () {
        try {
          if (WAT.on('dedupeNotif')) {
            const a = arguments[0];
            const key = a && typeof a === 'object' ? a.key : typeof a === 'string' ? a : null;
            if (typeof key === 'string' && key) {
              const text = a && typeof a === 'object' ? [a.body, a.text, a.message, a.title, a.header].filter(x => typeof x === 'string').join('|') : '';
              const sig = key + '|' + text, now = Date.now();
              for (const [k, t0] of seenNotif) if (now - t0 > 6 * 3600e3) seenNotif.delete(k);
              if (seenNotif.has(sig)) { WAT.log('notification: skipped a repeat'); return Promise.resolve(); }
              seenNotif.set(sig, now);
            }
          }
        } catch {}
        return orig.apply(this, arguments);
      };
      wrapped.__watDedupe = true;
      H.showMessageNotification = wrapped; notifPatched = true;
    } catch {}
  }, 1500);

  /* ---------- sticker confirmation + double-click reaction (need WhatsApp internals) ---------- */
  let patched = false;
  setInterval(() => {
    if (patched) return;
    try {
      const SSA = WAT.req('WAWebSendStickerAction'); if (!SSA || !SSA.sendStickerToChat) return;
      const ss = SSA.sendStickerToChat;
      SSA.sendStickerToChat = function () {
        if (!WAT.on('confirmSticker')) return ss.apply(this, arguments);
        const a = arguments, self = this;
        WAT.confirm(t('f.confirmSticker.dialog'), t('f.confirmSticker.dialogBody'), t('ui.send')).then(ok => { if (ok) ss.apply(self, a); });
        return Promise.resolve();
      };
      patched = true;
    } catch {}
  }, 1000);

  document.addEventListener('dblclick', e => {
    try {
      if (!WAT.on('dblReact')) return;
      if (e.target.closest('a,button,[role=button],input,textarea,[contenteditable=true],video,img')) return;
      const row = e.target.closest('[data-id]'); if (!row) return;
      const msg = WAT.msgIndex().get(row.getAttribute('data-id')); if (!msg) return;
      const RXA = WAT.req('WAWebSendReactionMsgAction'); if (!RXA) return;
      window.getSelection && window.getSelection().removeAllRanges();
      RXA.sendReactionToMsg(msg, String(WAT.get('dblEmoji') || '👍').trim() || '👍');
    } catch {}
  }, true);

  /* ---------- per-row DOM adjustments (language independent: uses models + data-testid) ---------- */
  const TIME_END = /\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?\s?m\.?)?\s*$/i;
  const rowScan = () => {
    const doTime = WAT.on('timeSeconds'), doFwd = WAT.on('hideForwarded');
    const words = String(WAT.get('highlightWords') || '').split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!doTime && !doFwd && !words.length) return;
    const rows = document.querySelectorAll('[data-id]'); if (!rows.length) return;
    const idx = WAT.msgIndex();
    const color = WAT.get('highlightColor') || '#f5a623';
    for (const row of rows) {
      const msg = idx.get(row.getAttribute('data-id')); if (!msg) continue;
      if (doTime && msg.t) {
        const meta = row.querySelector('[data-testid="msg-meta"]');
        const txt = new Date(msg.t * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
        if (meta) for (const sp of meta.querySelectorAll('span')) {
          if (sp.children.length === 0 && /\d{1,2}:\d{2}/.test(sp.textContent) && !sp.closest('.wat-edit') && sp.textContent !== txt) { sp.textContent = txt; break; }
        }
        // WhatsApp keeps an invisible copy of the time inside the text so the text wraps before it. Keep that copy
        // as wide as the visible time, or the longer time (with seconds) sits on top of the end of the text.
        for (const sp of row.querySelectorAll('[aria-hidden="true"] span, span[aria-hidden="true"]')) {
          if (sp.children.length !== 0 || (meta && meta.contains(sp))) continue;
          const cur = sp.textContent, m = TIME_END.exec(cur);       // an edited message's copy reads "Edited 8:41 p. m."
          if (m && cur.length < 60 && m[0].trim() !== txt) sp.textContent = cur.slice(0, m.index) + txt;
        }
      }
      if (doFwd && msg.isForwarded) {
        const ic = row.querySelector('[data-icon*="forward"]');
        const box = ic && (ic.closest('span[dir]') || ic.parentElement);
        if (box && box.parentElement) box.parentElement.style.display = 'none';
      }
      if (words.length) {
        const c = row.querySelector('[data-testid="msg-container"]');
        if (c) {
          const body = (typeof msg.body === 'string' && msg.type === 'chat' ? msg.body : msg.caption || '').toLowerCase();
          const hit = body && words.some(w => body.includes(w));
          c.style.boxShadow = hit ? 'inset 0 0 0 2px ' + color : '';
        }
      }
    }
  };
  setInterval(() => { try { rowScan(); } catch {} }, 400);

  /* ---------- "save what I'm viewing" button ---------- */
  function bigMedia() {
    let best = null, area = 0;
    for (const m of document.querySelectorAll('video,img')) {
      if (m.closest('[data-id],.wat-ov,.wat-panel')) continue;
      const r = m.getBoundingClientRect(), a = r.width * r.height;
      if (r.width >= 280 && r.height >= 280 && a > area && r.top >= 0 && r.bottom <= innerHeight + 4) { best = m; area = a; }
    }
    return best;
  }
  let saveBtn = null;
  setInterval(() => {
    if (!WAT.nowReady()) return;
    if (!saveBtn) {
      saveBtn = el('button', {
        class: 'wat-btn wat-save', style: 'position:fixed;top:58px;right:24px;z-index:2147483000;display:none', onclick: async () => {
          const m = bigMedia(); if (!m) return; const src = m.currentSrc || m.src; if (!src) return;
          try {
            const blob = await (await fetch(src)).blob();
            const ext = (blob.type.split('/')[1] || (m.tagName === 'VIDEO' ? 'mp4' : 'jpg')).split(';')[0].replace('jpeg', 'jpg');
            const a = el('a', { href: URL.createObjectURL(blob), download: 'whatsapp-' + Date.now() + '.' + ext });
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
          } catch (e) { WAT.toast(t('ui.error'), String(e.message || e), 'err'); }
        },
      }, '⬇ ' + t('ui.save'));
      document.body.appendChild(saveBtn);
    }
    saveBtn.textContent = '⬇ ' + t('ui.save');
    saveBtn.style.display = WAT.on('saveMedia') && bigMedia() ? 'block' : 'none';
  }, 1000);

  /* ---------- quick replies ---------- */
  function insertText(text) {
    const c = document.querySelector('footer [contenteditable="true"]'); if (!c) return false;
    c.focus(); document.execCommand('insertText', false, text); return true;
  }
  function parseReplies() {
    return String(WAT.get('quickReplies') || '').split('\n').map(l => { const i = l.indexOf('='); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : null; }).filter(x => x && x.k && x.v);
  }
  WAT.addShortcut('quickReplyShortcut', () => {
    const list = parseReplies();
    if (!list.length) { WAT.toast(t('f.quickReplies.name'), t('f.quickReplies.empty'), 'warn'); return; }
    const ov = el('div', { class: 'wat-ov' });
    const q = el('input', { class: 'wat-in', placeholder: t('ui.search'), style: 'width:100%;box-sizing:border-box' });
    const box = el('div', { style: 'max-height:48vh;overflow:auto;margin-top:8px' });
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc, true);
    const draw = () => {
      box.replaceChildren(); const s = q.value.trim().toLowerCase();
      for (const r of list.filter(x => !s || x.k.toLowerCase().includes(s) || x.v.toLowerCase().includes(s))) box.append(el('button', { class: 'wat-btn', style: 'display:block;width:100%;text-align:left;margin-bottom:6px;white-space:normal', onclick: () => { close(); insertText(r.v); } }, el('b', {}, r.k), ' — ', r.v));
    };
    q.oninput = draw; q.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const b = box.firstChild; if (b) b.click(); } if (e.key === 'Escape') close(); });
    draw();
    ov.append(el('div', { class: 'wat-panel', style: 'display:block;width:min(460px,92vw);height:auto;padding:16px' }, el('h2', { style: 'margin:0 0 8px;font-size:17px' }, t('f.quickReplies.name')), q, box));
    document.body.appendChild(ov); ov.addEventListener('mousedown', e => { if (e.target === ov) close(); }); setTimeout(() => q.focus(), 30);
  });

  /* ---------- export open chat ---------- */
  const pad = n => String(n).padStart(2, '0');
  const fmt = ts => { const d = new Date(ts * 1000); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
  async function exportChat(btn, kind) {
    const idle = btn.textContent;
    try {
      const chat = WAT.activeChat(); if (!chat) throw new Error(t('gif.openChat'));
      const LM = WAT.req('WAWebChatLoadMessages');
      let n = 0;
      while (!chat.noEarlierMsgs && n < 80 && LM) { btn.textContent = t('ui.loading') + ' ' + (++n); await LM.loadEarlierMsgs(chat); }
      const arr = (chat.msgs.getModelsArray ? chat.msgs.getModelsArray() : chat.msgs.models).filter(m => m && m.id && m.t).sort((a, b) => a.t - b.t);
      const who = m => (m.id.fromMe ? t('ui.me') : (m.senderObj && (m.senderObj.formattedName || m.senderObj.pushname)) || m.notifyName || String(m.author || m.from || '').split('@')[0]);
      const txt = m => (m.type === 'chat' || m.type === 'conversation') && typeof m.body === 'string' ? m.body : '<' + m.type + '>' + (m.caption ? ' ' + m.caption : '');
      const title = String(chat.formattedTitle || chat.name || 'chat').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
      if (kind === 'json') WAT.download('chat-' + title + '.json', JSON.stringify({ chat: chat.formattedTitle || chat.name, exportedAt: new Date().toISOString(), count: arr.length, messages: arr.map(m => ({ ts: m.t, date: new Date(m.t * 1000).toISOString(), fromMe: !!m.id.fromMe, sender: who(m), type: m.type, text: txt(m) })) }, null, 2), 'application/json');
      else WAT.download('chat-' + title + '.txt', arr.map(m => '[' + fmt(m.t) + '] ' + who(m) + ': ' + txt(m)).join(String.fromCharCode(10)));
      btn.textContent = '✓ ' + arr.length;
    } catch (e) { btn.textContent = String(e.message || e); }
    setTimeout(() => { btn.textContent = idle; }, 3000);
  }
})();
