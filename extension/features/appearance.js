/* Appearance: bubble colours, compact mode, hide side-bar items, custom CSS. */
(() => {
  const WAT = window.WAT; if (!WAT) return;

  WAT.section('appearance', [
    { id: 'colorIn', type: 'color', def: '' },
    { id: 'colorOut', type: 'color', def: '' },
    { id: 'compact', type: 'toggle', def: false, rerender: true },
    { id: 'compactZoom', type: 'number', def: 88, min: 60, max: 100, showIf: () => WAT.on('compact') },
    { id: 'compactShortcut', type: 'shortcut', def: 'Ctrl+Alt+K' },
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
})();
