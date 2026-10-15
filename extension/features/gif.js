/* GIF picker: adds a KLIPY provider next to WhatsApp's native one.
 * - Needs a free Klipy API key (Settings > GIF). Without a key nothing changes: WhatsApp's own GIFs keep working.
 * - GIFs are sent through WhatsApp's own "send GIF" flow so they arrive as real GIFs (not photos/videos). */
(() => {
  const WAT = window.WAT; if (!WAT) return;
  const { t, el } = WAT;

  WAT.section('gif', [
    { id: 'gifInfo', type: 'info' },
    { id: 'klipyKey', type: 'text', def: '', global: true, width: 260, placeholder: 'Klipy API key' },
    { id: 'klipyFilter', type: 'select', def: 'medium', global: true, options: [{ v: 'off', key: 'gif.fOff' }, { v: 'low', key: 'gif.fLow' }, { v: 'medium', key: 'gif.fMed' }, { v: 'high', key: 'gif.fHigh' }] },
    { id: 'gifGuide', type: 'action', run: () => window.open('https://github.com/' + WAT.repo + '/blob/main/docs/KEYS.md', '_blank') },
  ], 40);

  const PROVIDERS = ['native', 'klipy'];
  const getProv = () => { try { const v = localStorage.getItem('wat.gifProvider'); return PROVIDERS.includes(v) ? v : 'native'; } catch { return 'native'; } };
  const setProv = v => { try { localStorage.setItem('wat.gifProvider', v); } catch {} };
  const hasKey = () => !!String(WAT.get('klipyKey') || '').trim();

  /* ---- Klipy API ---- */
  async function klipy(text, page) {
    const base = { page, per_page: 30, customer_id: 'wat-' + (localStorage.getItem('wat.cid') || (localStorage.setItem('wat.cid', Math.random().toString(36).slice(2, 12)), localStorage.getItem('wat.cid'))), content_filter: WAT.get('klipyFilter') || 'medium', format_filter: 'mp4,webp,gif' };
    if (text) base.q = text;
    const url = 'https://api.klipy.com/api/v1/' + encodeURIComponent(String(WAT.get('klipyKey')).trim()) + '/gifs/' + (text ? 'search' : 'trending') + '?' + new URLSearchParams(base);
    const j = await WAT.fetchJson(url);
    const arr = (j.data && (j.data.data || j.data)) || [];
    return arr.map(r => {
      const f = r.file || {};
      const thumb = ['md', 'sm', 'hd', 'xs'].map(k => f[k] && f[k].webp).find(x => x && x.url);
      const mp4s = ['hd', 'md', 'sm', 'xs'].map(k => f[k] && f[k].mp4 && f[k].mp4.url).filter(Boolean);
      if (!thumb || !mp4s.length) return null;
      return { id: 'kl' + (r.slug || r.id), title: r.title || '', preview: thumb.url, mp4s, ratio: thumb.width ? thumb.height / thumb.width : 0.75 };
    }).filter(Boolean);
  }

  /* ---- sending through WhatsApp's native GIF flow ---- */
  async function sendGif(it, host) {
    try {
      const chat = WAT.activeChat(); if (!chat) throw new Error(t('gif.openChat'));
      const R = window.require;
      const fetchGif = R('WAWebComposeBoxUtils').fetchGif, Cmd = R('WAWebCmd').Cmd;
      let last = null;
      for (const u of it.mp4s) {                       // some Klipy sizes cannot be decoded here; try the next one
        try {
          const blob = await WAT.fetchBlob(u, 'video/mp4');
          const url = URL.createObjectURL(blob);
          const res = await fetchGif({ accessibilityLabel: it.title, attribution: 3 /* KLIPY */, filename: 'gif.mp4', gifUrl: url });
          Cmd.attachMediaDrawer({
            chat, threadId: undefined, attachments: [Promise.resolve(res)],
            bot3pMediaInputAuthorized: R('WAWebResolveSupportedMediaTypes').isBot3pMediaInputEnabled(chat),
            initCaption: '', fileOrigin: R('WAWebWamEnumMediaPickerOriginType').MEDIA_PICKER_ORIGIN_TYPE.CHAT_GIF_INAPP,
            onComplete: () => setTimeout(() => URL.revokeObjectURL(url), 60000),
          });
          return;
        } catch (e) { last = e; }
      }
      throw last || new Error('no compatible format');
    } catch (e) { WAT.toast(t('gif.sendFail'), String(e && e.message || e), 'err'); }
  }

  /* ---- UI injected into the native picker ---- */
  const done = new WeakSet();
  function setup(input) {
    if (done.has(input) && input.__watBar && input.__watBar.isConnected) return;
    done.add(input);
    const row = input.parentElement.parentElement.parentElement.parentElement;
    if (!row || !row.parentElement) return;
    const bar = el('div', { style: 'display:flex;gap:6px;padding:6px 14px 2px' });
    const cols = el('div', { style: 'columns:3;column-gap:6px;padding:4px 10px' });
    const grid = el('div', { style: 'overflow-y:auto;overflow-x:hidden;display:none' }, cols);
    row.parentElement.insertBefore(bar, row); input.__watBar = bar;
    let token = 0, timer = 0, native = null; const st = { page: 1, done: false, loading: false, seen: new Set() };
    const orig = { ph: input.getAttribute('placeholder'), al: input.getAttribute('aria-label') };

    const findScroller = () => {
      const b = document.querySelector('button[data-testid="gif-preview"]'); let n = b;
      while (n && n !== document.body) {
        n = n.parentElement; if (!n) break;
        if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.clientHeight > 100 && n.scrollHeight > n.clientHeight + 20) return n;
      }
      return null;
    };
    const label = () => {
      const p = getProv(); const txt = p === 'native' ? null : t('gif.searchIn', { provider: 'Klipy' });
      const ph = txt || orig.ph, al = txt || orig.al;
      if (ph !== null && input.getAttribute('placeholder') !== ph) input.setAttribute('placeholder', ph);
      if (al !== null && input.getAttribute('aria-label') !== al) input.setAttribute('aria-label', al);
    };
    new MutationObserver(label).observe(input, { attributes: true, attributeFilter: ['placeholder', 'aria-label'] });

    const render = (arr, msg, append) => {
      if (!append) cols.replaceChildren();
      if (msg || (!arr.length && !append)) { cols.append(el('div', { style: 'padding:20px;text-align:center;column-span:all;color:var(--secondary,#8696a0)' }, msg || t('gif.none'))); return; }
      for (const it of arr) {
        const img = el('img', { style: 'width:100%;display:block;aspect-ratio:1/' + (it.ratio || 1) });
        WAT.fetchBlob(it.preview, 'image/webp').then(b => { img.src = URL.createObjectURL(b); }).catch(() => {});
        cols.append(el('button', { style: 'break-inside:avoid;margin-bottom:6px;border:0;padding:0;background:var(--background-default-hover,#222);border-radius:6px;overflow:hidden;cursor:pointer;display:block;width:100%', title: it.title, onclick: () => sendGif(it, grid) }, img));
      }
    };
    const run = async () => {
      const prov = getProv(); const my = ++token; label();
      native = native || findScroller();
      if (prov === 'native' || !hasKey()) { grid.style.display = 'none'; return; }
      if (!native) { setTimeout(run, 400); return; }
      const par = native.parentElement;
      if (getComputedStyle(par).position === 'static') par.style.position = 'relative';
      if (grid.parentElement !== par) par.appendChild(grid);
      let bg = 'rgb(17,27,33)';
      for (let n = native; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(.*,\s*0\)|transparent/.test(c)) { bg = c; break; } }
      Object.assign(grid.style, { display: '', position: 'absolute', top: native.offsetTop + 'px', left: native.offsetLeft + 'px', width: native.offsetWidth + 'px', height: native.offsetHeight + 'px', zIndex: '5', background: bg });
      render([], t('gif.searching'));
      st.page = 1; st.done = false; st.loading = true; st.seen = new Set();
      try { const r = await klipy(input.value.trim(), 1); if (my === token) { r.forEach(x => st.seen.add(x.id)); render(r); if (!r.length) st.done = true; } }
      catch (e) { if (my === token) { render([], t('ui.error') + ': ' + e.message); st.done = true; } }
      finally { if (my === token) st.loading = false; }
    };
    const more = async () => {
      if (st.loading || st.done || grid.style.display === 'none') return;
      st.loading = true; const my = token;
      try {
        const r = (await klipy(input.value.trim(), st.page + 1)).filter(x => !st.seen.has(x.id));
        if (my !== token) return;
        st.page++; r.forEach(x => st.seen.add(x.id)); if (!r.length) st.done = true; else render(r, null, true);
      } catch { st.done = true; } finally { st.loading = false; }
    };
    grid.addEventListener('scroll', () => { if (grid.scrollTop + grid.clientHeight > grid.scrollHeight - 400) more(); });

    const chips = {};
    for (const [k, name] of [['native', t('gif.native')], ['klipy', 'Klipy']]) {
      chips[k] = el('button', { class: 'wat-btn', style: 'padding:3px 11px;font-size:12.5px', onclick: () => { setProv(k); paint(); run(); } }, name);
      bar.append(chips[k]);
    }
    const paint = () => { for (const k of PROVIDERS) { chips[k].style.background = getProv() === k ? 'var(--teal,#00a884)' : ''; chips[k].style.color = getProv() === k ? '#fff' : ''; } };
    paint();
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 400); });
    if (getProv() !== 'native' && hasKey()) setTimeout(run, 300);
  }

  setInterval(() => {
    try {
      if (!hasKey()) { document.querySelectorAll('[data-wat-gifbar]').forEach(b => b.remove()); return; }
      const b = document.querySelector('button[data-testid="gif-preview"]'); if (!b) return;
      let n = b, input = null;
      while (n && n !== document.body && !input) { n = n.parentElement; input = n && n.querySelector && n.querySelector('input[role="textbox"]'); }
      if (input) setup(input);
    } catch {}
  }, 500);
})();
