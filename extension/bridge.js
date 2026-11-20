// Isolated-world relay: the page (MAIN world) cannot talk to the extension directly.
// It posts {wat:'req', id, url, headers}; we forward it to the service worker and post the answer back.
window.addEventListener('message', e => {
  if (e.source !== window || !e.data || e.data.wat !== 'req') return;
  const { id, url, headers } = e.data;
  try {
    chrome.runtime.sendMessage({ type: 'wat:fetch', url, headers }, res => {
      const err = chrome.runtime.lastError;
      window.postMessage({ wat: 'res', id, res: res || { error: err ? err.message : 'no response' } }, '*');
    });
  } catch (err) {
    window.postMessage({ wat: 'res', id, res: { error: String(err && err.message || err) } }, '*');
  }
});

// Event log that survives a WhatsApp log-out (the page's own storage is wiped then): kept in the extension's storage, capped.
const EV_KEY = 'watEvents', EV_MAX = 300;
window.addEventListener('message', e => {
  if (e.source !== window || !e.data) return;
  try {
    if (e.data.wat === 'ev' && typeof e.data.line === 'string') {
      chrome.storage.local.get(EV_KEY, o => {
        const a = Array.isArray(o && o[EV_KEY]) ? o[EV_KEY] : [];
        a.push(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' ' + e.data.line.slice(0, 220));
        chrome.storage.local.set({ [EV_KEY]: a.slice(-EV_MAX) });
      });
    } else if (e.data.wat === 'evget') {
      chrome.storage.local.get(EV_KEY, o => window.postMessage({ wat: 'evres', id: e.data.id, list: (o && o[EV_KEY]) || [] }, '*'));
    }
  } catch {}
});
