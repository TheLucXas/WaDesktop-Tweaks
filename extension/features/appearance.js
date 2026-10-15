/* Appearance: bubble colours, compact mode, hide side-bar items, custom CSS. */
(() => {
  const WAT = window.WAT; if (!WAT) return;

  WAT.section('appearance', [
    { id: 'colorIn', type: 'color', def: '' },
    { id: 'colorOut', type: 'color', def: '' },
    { id: 'compact', type: 'toggle', def: false, rerender: true },
    { id: 'compactZoom', type: 'number', def: 88, min: 60, max: 100, showIf: () => WAT.on('compact') },
    { id: 'compactShortcut', type: 'shortcut', def: 'Ctrl+Alt+K' },
    { id: 'smoothScroll', type: 'toggle', def: false, rerender: true },
    { id: 'smoothSpeed', type: 'number', def: 100, min: 50, max: 300, showIf: () => WAT.on('smoothScroll') },
    { id: 'smoothTime', type: 'number', def: 280, min: 80, max: 900, showIf: () => WAT.on('smoothScroll') },
    { id: 'hideStatusTab', type: 'toggle', def: false },
    { id: 'hideChannels', type: 'toggle', def: false },
    { id: 'hideCommunities', type: 'toggle', def: false },
    { id: 'hideMetaAI', type: 'toggle', def: false },
    { id: 'customCss', type: 'textarea', def: '', placeholder: '/* your CSS */' },
  ], 60);

  const style = document.createElement('style'); style.id = 'wat-theme';
  const rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function apply() {
    if (!document.documentElement) return;
    if (!style.isConnected) document.documentElement.appendChild(style);
    let css = '';
    for (const [id, name] of [['colorIn', 'incoming'], ['colorOut', 'outgoing']]) {
      const c = WAT.get(id), v = rgb(c);
      if (v) css += `html,html body,.dark,.light{--WDS-systems-bubble-surface-${name}:${c}!important;--WDS-systems-bubble-surface-${name}-RGB:${v.join(', ')}!important}\n`;
    }
    css += WAT.get('customCss') || '';
    if (style.textContent !== css) style.textContent = css;
  }
  WAT.onEvent('change', apply);

  // Side-bar items are found by the icon inside their button (language independent). WhatsApp's own
  // data-navbar-item-index is not reliable (an item such as Calls can lack it, shifting every other index), so
  // the position of the item in the bar is only the fallback when no icon matches.
  const RAIL = { hideStatusTab: [/status/i, 2], hideChannels: [/newsletter|channel/i, 3], hideCommunities: [/communit/i, 4] };
  const iconOf = b => { const i = b.querySelector('[data-icon]'); return i ? i.getAttribute('data-icon') || '' : ''; };
  // a button is hidden through its cell; only cells hidden by us are touched when showing again
  const setCell = (m, hide) => {
    const cell = m.tagName === 'BUTTON' ? m.parentElement : m;
    if (!cell || cell === document.body) return;
    if (hide) { if (cell.style.display !== 'none') cell.style.display = 'none'; cell.dataset.watHid = '1'; }
    else if (cell.dataset.watHid) { cell.style.display = ''; delete cell.dataset.watHid; }
  };
  setInterval(() => {
    apply();
    const app = document.getElementById('app');
    if (app) {
      const z = WAT.on('compact') ? Math.min(100, Math.max(60, Number(WAT.get('compactZoom')) || 88)) / 100 : 1;
      const want = z === 1 ? '' : String(z);
      if (String(app.style.zoom || '') !== want) app.style.zoom = want;
    }
    const items = [...document.querySelectorAll('[data-navbar-item]')];
    if (!items.length) return;
    for (const [id, [rx, pos]] of Object.entries(RAIL)) {
      const byIcon = items.filter(b => rx.test(iconOf(b)));
      const targets = byIcon.length ? byIcon : (items[pos] ? [items[pos]] : []);
      const hide = WAT.on(id);
      targets.forEach(m => setCell(m, hide));
    }
    const hideAI = WAT.on('hideMetaAI');
    items.filter(m => m.getAttribute('aria-label') === 'Meta AI').forEach(m => setCell(m, hideAI));
  }, 400);

  WAT.addShortcut('compactShortcut', () => WAT.set('compact', !WAT.on('compact')));

  /* ---------- smooth wheel scrolling ----------
   * Mouse wheels jump ~100px per notch. We take over those events, work out which element would scroll and glide
   * it to the target with an exponential ease. Touchpads (non-multiple-of-120 deltas) are already smooth: untouched. */
  const glides = new WeakMap();
  const scrollerFor = (start, dy) => {
    for (let n = start; n && n !== document.documentElement; n = n.parentElement) {
      if (n.nodeType !== 1 || !/(auto|scroll|overlay)/.test(getComputedStyle(n).overflowY)) continue;
      const max = n.scrollHeight - n.clientHeight;
      if (max <= 1) continue;
      if ((dy < 0 && n.scrollTop > 0) || (dy > 0 && n.scrollTop < max - 1)) return n;   // at its limit: let a parent take it
    }
    return null;
  };
  // The animation tracks the distance still to travel (`rem`), not an absolute target: when WhatsApp prepends
  // older messages it shifts scrollTop, and an absolute target would keep dragging the list to the (new) top.
  function glide(node, dy) {
    let s = glides.get(node);
    if (!s) glides.set(node, (s = { rem: 0, raf: 0, last: 0 }));
    if (Math.sign(dy) !== Math.sign(s.rem)) s.rem = 0;                    // direction reversed: drop the inertia
    const lim = Math.max(800, node.clientHeight * 2);
    s.rem = Math.max(-lim, Math.min(lim, s.rem + dy));
    if (s.raf) return;
    s.last = performance.now();
    const step = now => {
      const dt = Math.min(64, now - s.last); s.last = now;
      const tau = Math.max(80, Number(WAT.get('smoothTime')) || 280) / 4;
      let mv = s.rem * (1 - Math.exp(-dt / tau));
      if (Math.abs(mv) < 1) mv = Math.sign(s.rem) * Math.min(1, Math.abs(s.rem));   // never stall below 1px/frame
      const before = node.scrollTop;
      node.scrollTop = before + mv;
      const moved = node.scrollTop - before;
      s.rem -= mv;
      // arrived, or the list reached an edge: forget the rest, like a native scroll that stops at the edge,
      // so nothing keeps pushing while WhatsApp loads older messages
      const atEdge = (s.rem < 0 && node.scrollTop <= 0) || (s.rem > 0 && node.scrollTop >= node.scrollHeight - node.clientHeight - 0.5);
      if (Math.abs(s.rem) < 1 || Math.abs(moved) < 0.5 || atEdge) { s.rem = 0; s.raf = 0; return; }
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }
  window.addEventListener('wheel', e => {
    if (!WAT.on('smoothScroll') || e.ctrlKey || e.shiftKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const wd = e.wheelDeltaY;
    if (typeof wd === 'number' ? (!wd || wd % 120) : (!Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 50)) return;   // touchpad / precision wheel
    const t0 = e.target;
    if (!(t0 instanceof Element) || t0.closest('textarea,input,select,video,audio,[contenteditable="true"]')) return;
    const node = scrollerFor(t0, e.deltaY); if (!node) return;
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? node.clientHeight : 1;
    e.preventDefault();
    glide(node, e.deltaY * unit * (Math.min(300, Math.max(50, Number(WAT.get('smoothSpeed')) || 100)) / 100));
  }, { passive: false, capture: true });
})();
