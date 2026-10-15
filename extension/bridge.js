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
