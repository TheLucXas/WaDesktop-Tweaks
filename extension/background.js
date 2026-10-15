// Service worker: performs the few network requests the page itself is not allowed to make
// (WhatsApp Web's Content-Security-Policy blocks third-party hosts). The allowed hosts are the
// ones listed in manifest.json "host_permissions": Klipy (GIF search) and the GitHub API (update check).
const ALLOWED = [
  /^https:\/\/api\.klipy\.com\//,
  /^https:\/\/static[12]?\.klipy\.com\//,
  /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/latest$/
];

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'wat:fetch') return;
  if (!ALLOWED.some(re => re.test(String(msg.url)))) { sendResponse({ error: 'host not allowed' }); return; }
  (async () => {
    try {
      const r = await fetch(msg.url, { headers: msg.headers || {}, cache: 'no-store' });
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 25 * 1024 * 1024) { sendResponse({ error: 'response too large' }); return; }
      sendResponse({ ok: r.ok, status: r.status, type: r.headers.get('content-type') || '', b64: toBase64(buf) });
    } catch (e) { sendResponse({ error: String(e && e.message || e) }); }
  })();
  return true; // asynchronous response
});
