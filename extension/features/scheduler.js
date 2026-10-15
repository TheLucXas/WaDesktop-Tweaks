/* Scheduled messages (HIGH RISK). Messages are sent from this app while WhatsApp is open and the PC is on.
 * Automated sending is the kind of behaviour WhatsApp may flag: keep it low-volume and use at your own risk. */
(() => {
  const WAT = window.WAT; if (!WAT) return;
  const { t, el } = WAT;

  WAT.section('scheduler', [
    { id: 'schedInfo', type: 'info' },
    { id: 'schedEnabled', type: 'toggle', def: false, risk: 'high' },
    { id: 'openScheduler', type: 'action', run: () => openManager() },
  ], 55);

  const MAX_LATE_MS = 15 * 60 * 1000;
  const chatsList = () => {
    try {
      const C = WAT.req('WAWebChatCollection').ChatCollection;
      return (C.getModelsArray ? C.getModelsArray() : C.models)
        .filter(c => c && c.id && !String(c.id._serialized || c.id).includes('status@') && !String(c.id._serialized || c.id).includes('@newsletter'))
        .map(c => ({ id: String(c.id._serialized || c.id), name: c.formattedTitle || c.name || String(c.id).split('@')[0] }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch { return []; }
  };

  async function sendNow(job) {
    const C = WAT.req('WAWebChatCollection').ChatCollection;
    const chat = C.get(job.chatId); if (!chat) throw new Error('chat not found');
    const S = WAT.req('WAWebSendTextMsgChatAction'); if (!S || !S.sendTextMsgToChat) throw new Error('send API not available');
    await S.sendTextMsgToChat(chat, job.text, {});
  }

  let busy = false;
  setInterval(async () => {
    if (busy || !WAT.on('schedEnabled')) return;
    busy = true;
    try {
      const now = Date.now();
      for (const j of await WAT.db.all('sched')) {
        if (j.status !== 'pending' || j.at > now) continue;
        if (now - j.at > MAX_LATE_MS) { j.status = 'missed'; await WAT.db.put('sched', j); WAT.toast(t('sched.missed'), j.chatName + ': ' + j.text.slice(0, 60), 'warn'); continue; }
        try { await sendNow(j); j.status = 'sent'; j.sentAt = Date.now(); WAT.toast(t('sched.sent'), j.chatName, ''); }
        catch (e) { j.status = 'failed'; j.error = String(e && e.message || e); WAT.toast(t('sched.failed'), j.chatName + ': ' + j.error, 'err'); }
        await WAT.db.put('sched', j);
      }
    } catch (e) { WAT.log('scheduler: ' + e); }
    busy = false;
  }, 15000);

  async function openManager() {
    const ov = el('div', { class: 'wat-ov' });
    const panel = el('div', { class: 'wat-panel', style: 'display:block;padding:16px 18px;overflow:auto' });
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc, true);
    const chats = chatsList();
    const sel = el('select', { class: 'wat-in', style: 'width:100%;margin:6px 0' }, chats.map(c => el('option', { value: c.id }, c.name)));
    const txt = el('textarea', { class: 'wat-in', placeholder: t('sched.text') });
    const when = el('input', { class: 'wat-in', type: 'datetime-local', style: 'margin:6px 0' });
    const list = el('div', { class: 'wat-list' });
    const fmt = x => new Date(x).toLocaleString();
    const draw = async () => {
      list.replaceChildren(); const jobs = (await WAT.db.all('sched')).sort((a, b) => a.at - b.at);
      if (!jobs.length) list.append(el('div', { class: 'wat-hint' }, t('sched.none')));
      for (const j of jobs) list.append(el('div', { class: 'it' },
        el('div', { class: 'h' }, fmt(j.at) + ' · ' + j.chatName + ' · ' + t('sched.st.' + j.status) + (j.error ? ' (' + j.error + ')' : '')),
        el('div', { class: 'b' }, j.text),
        el('button', { class: 'wat-btn', style: 'margin-top:6px', onclick: async () => { await WAT.db.del('sched', j.id); draw(); } }, t('ui.delete'))));
    };
    const add = el('button', { class: 'wat-btn pri', onclick: async () => {
      const at = new Date(when.value).getTime(); const text = txt.value.trim();
      if (!text || !isFinite(at) || at < Date.now() + 5000) { WAT.toast(t('sched.invalid'), '', 'warn'); return; }
      const c = chats.find(x => x.id === sel.value); if (!c) return;
      await WAT.db.put('sched', { id: 's' + Date.now() + Math.random().toString(36).slice(2, 6), chatId: c.id, chatName: c.name, text, at, status: 'pending' });
      txt.value = ''; draw();
    } }, t('sched.add'));
    panel.append(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, el('h2', { style: 'margin:0;font-size:17px' }, '⏰ ' + t('f.openScheduler.name')), el('button', { class: 'wat-x', onclick: close }, '✕')),
      el('div', { class: 'wat-hint', style: 'color:#f5a623' }, '⚠ ' + t('risk.high')), el('div', { class: 'wat-hint' }, t('sched.how')),
      sel, txt, when, el('div', {}, add), el('div', { class: 'wat-hint' }, t('sched.list')), list);
    ov.append(panel); document.body.appendChild(ov); ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    draw();
  }
})();
