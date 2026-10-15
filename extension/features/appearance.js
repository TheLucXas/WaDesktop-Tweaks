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

  // Side-bar items are identified by their position (data-navbar-item-index), not by their translated label.
  const RAIL = { hideStatusTab: '2', hideChannels: '3', hideCommunities: '4' };
  setInterval(() => {
    apply();
    const app = document.getElementById('app');
    if (app) {
      const z = WAT.on('compact') ? Math.min(100, Math.max(60, Number(WAT.get('compactZoom')) || 88)) / 100 : 1;
      const want = z === 1 ? '' : String(z);
      if (String(app.style.zoom || '') !== want) app.style.zoom = want;
    }
    for (const [id, idx] of Object.entries(RAIL)) {
      const b = document.querySelector('button[data-navbar-item][data-navbar-item-index="' + idx + '"]');
      if (b && b.parentElement) b.parentElement.style.display = WAT.on(id) ? 'none' : '';
    }
    const ai = document.querySelector('button[data-navbar-item][aria-label="Meta AI"]');
    if (ai && ai.parentElement) ai.parentElement.style.display = WAT.on('hideMetaAI') ? 'none' : '';
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
  function glide(node, dy) {
    let s = glides.get(node);
    if (!s) glides.set(node, (s = { target: 0, raf: 0, last: 0 }));
    const max = node.scrollHeight - node.clientHeight;
    if (!s.raf || Math.sign(dy) !== Math.sign(s.target - node.scrollTop)) s.target = node.scrollTop;   // idle or reversed
    s.target = Math.max(0, Math.min(max, s.target + dy));
    if (s.raf) return;
    s.last = performance.now();
    const step = now => {
      const dt = Math.min(64, now - s.last); s.last = now;
      const tau = Math.max(80, Number(WAT.get('smoothTime')) || 280) / 4;
      const cur = node.scrollTop, diff = s.target - cur;
      if (Math.abs(diff) <= 1) { node.scrollTop = s.target; s.raf = 0; return; }
      let mv = diff * (1 - Math.exp(-dt / tau));
      if (Math.abs(mv) < 1) mv = Math.sign(diff);      // never stall below one pixel per frame
      node.scrollTop = cur + mv;
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
