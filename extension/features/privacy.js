/* Privacy: deferred read receipts, hide typing / recording / online / played / status-view signals. */
(() => {
  const WAT = window.WAT; if (!WAT) return;

  WAT.section('privacy', [
    { id: 'deferRead', type: 'toggle', def: true, risk: 'low' },
    { id: 'hideTyping', type: 'toggle', def: false, risk: 'low' },
    { id: 'hideRecording', type: 'toggle', def: false, risk: 'low' },
    { id: 'hideOnline', type: 'toggle', def: false, risk: 'low' },
    { id: 'hidePlayed', type: 'toggle', def: false, risk: 'low' },
    { id: 'hideStatusView', type: 'toggle', def: false, risk: 'low' },
    { id: 'markReadShortcut', type: 'shortcut', def: 'Ctrl+Alt+R' },
  ], 10);

  let origMark = null, SR = null, CC = null;
  WAT.markRead = async chat => {
    chat = chat || WAT.activeChat(); if (!chat) throw new Error('no chat');
    if (!origMark) throw new Error('not ready');
    return origMark.call(SR, chat, undefined, undefined);
  };

  function patch() {
    const req = window.require; if (typeof req !== 'function') return false;
    let CS, M, CSB, PCA, MPA;
    try {
      SR = req('WAWebSendReadReceiptJob'); CS = req('WAWebChatSendConversationSeen');
      M = req('WAWebCollections').Msg; CC = req('WAWebChatCollection').ChatCollection;
      CSB = req('WAWebChatStateBridge'); PCA = req('WAWebPresenceChatAction'); MPA = req('WAWebMarkPlayedMsgAction');
    } catch { return false; }
    if (!SR || !CS || !M || !CC) return false;
    if (SR.__watPatched) return true;

    const mark = SR.markChatRead, seen = CS.sendConversationSeen, status = SR.markStatusRead;
    origMark = mark;
    const stub = v => Promise.resolve(v);

    SR.markChatRead = function () { return WAT.on('deferRead') ? stub({ fullyReadThreadIds: [] }) : mark.apply(this, arguments); };
    CS.sendConversationSeen = function (a) {
      // unreadDelta === -1 only syncs "mark as unread -> read"; it does not send a receipt to the other person.
      if (WAT.on('deferRead') && !(a && a.unreadDelta === -1)) return stub({ fullyReadThreadIds: [] });
      return seen.apply(this, arguments);
    };
    if (status) SR.markStatusRead = function () { return WAT.on('hideStatusView') ? stub() : status.apply(this, arguments); };
    if (CSB) {
      const c = CSB.sendChatStateComposing, p = CSB.sendChatStatePaused, r = CSB.sendChatStateRecording;
      if (c) CSB.sendChatStateComposing = function () { return WAT.on('hideTyping') ? stub() : c.apply(this, arguments); };
      if (p) CSB.sendChatStatePaused = function () { return (WAT.on('hideTyping') || WAT.on('hideRecording')) ? stub() : p.apply(this, arguments); };
      if (r) CSB.sendChatStateRecording = function () { return WAT.on('hideRecording') ? stub() : r.apply(this, arguments); };
    }
    if (PCA && PCA.sendPresenceAvailable) { const a = PCA.sendPresenceAvailable; PCA.sendPresenceAvailable = function () { return WAT.on('hideOnline') ? stub() : a.apply(this, arguments); }; }
    if (MPA && MPA.markPlayed) { const mp = MPA.markPlayed; WAT.markPlayedOriginal = m => mp.call(MPA, m); MPA.markPlayed = function () { return WAT.on('hidePlayed') ? stub() : mp.apply(this, arguments); }; }
    SR.__watPatched = true;

    // Deferred read: when you send something in a chat, that chat's read receipt goes out.
    M.on('add', m => {
      try {
        if (m && m.id && m.id.fromMe && WAT.on('deferRead') && Math.abs(Date.now() / 1000 - (m.t || 0)) <= 30) {
          const chat = CC.get(m.id.remote);
          if (chat && chat.unreadCount !== 0) setTimeout(() => mark.call(SR, chat, undefined, undefined).catch(() => {}), 400);
        }
      } catch {}
    });
    WAT.emit('patched');
    return true;
  }
  const timer = setInterval(() => { try { if (patch()) clearInterval(timer); } catch (e) { WAT.log('privacy patch: ' + e); } }, 700);

  WAT.addQuickAction('✓✓', 'f.markRead.title', async () => {
    try { await WAT.markRead(); WAT.toast(WAT.t('f.markRead.done'), '', ''); } catch (e) { WAT.toast(WAT.t('ui.error'), String(e.message || e), 'err'); }
  });
  WAT.addShortcut('markReadShortcut', () => WAT.markRead().then(() => WAT.toast(WAT.t('f.markRead.done')), e => WAT.toast(WAT.t('ui.error'), String(e.message || e), 'err')));
})();
