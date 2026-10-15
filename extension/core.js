/* WaDesktop-Tweaks — core: namespace, settings/profiles, i18n, helpers.
 * Runs in the page ("MAIN" world) so it can reach WhatsApp's internal module loader (window.require). */
(() => {
  if (window.WAT) return;
  const WAT = (window.WAT = { version: '0.1.0', repo: 'TheLucXas/WaDesktop-Tweaks', sections: [], locales: {}, _ev: {} });

  /* ---------- tiny event bus ---------- */
  WAT.onEvent = (n, fn) => ((WAT._ev[n] ||= []).push(fn), fn);
  WAT.emit = (n, ...a) => (WAT._ev[n] || []).forEach(f => { try { f(...a); } catch (e) { WAT.log('event ' + n + ': ' + e); } });

  /* ---------- diagnostics log (ring buffer) ---------- */
  WAT.logs = [];
  WAT.log = m => { WAT.logs.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (WAT.logs.length > 200) WAT.logs.shift(); };

  /* ---------- settings: global values + named profiles ---------- */
  const KEY = 'wat.cfg';
  const readCfg = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let cfg = readCfg();
  cfg.active = cfg.active || 'default';
  cfg.profiles = cfg.profiles || { default: {} };
  cfg.global = cfg.global || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };

  WAT.items = () => WAT.sections.flatMap(s => s.items);
  WAT.item = id => WAT.items().find(i => i.id === id);
  WAT.profile = () => (cfg.profiles[cfg.active] ||= {});
  WAT.profiles = () => Object.keys(cfg.profiles);
  WAT.activeProfile = () => cfg.active;
  WAT.get = id => {
    const it = WAT.item(id);
    const store = it && it.global ? cfg.global : WAT.profile();
    return id in store ? store[id] : it ? it.def : undefined;
  };
  WAT.on = id => WAT.get(id) === true;
  WAT.set = (id, v) => {
    const it = WAT.item(id);
    (it && it.global ? cfg.global : WAT.profile())[id] = v;
    save(); WAT.emit('change', id, v);
  };
  WAT.useProfile = name => { if (!cfg.profiles[name]) return; cfg.active = name; save(); WAT.emit('profile', name); WAT.emit('change', '*'); };
  WAT.newProfile = (name, copyFrom) => {
    name = String(name || '').trim().slice(0, 40); if (!name || cfg.profiles[name]) return false;
    cfg.profiles[name] = JSON.parse(JSON.stringify(copyFrom ? cfg.profiles[copyFrom] || {} : {})); save(); return true;
  };
  WAT.deleteProfile = name => { if (name === 'default' || !cfg.profiles[name]) return false; delete cfg.profiles[name]; if (cfg.active === name) cfg.active = 'default'; save(); WAT.emit('change', '*'); return true; };
  WAT.exportConfig = () => JSON.stringify({ wat: WAT.version, cfg }, null, 2);
  WAT.importConfig = text => {
    const d = JSON.parse(text); if (!d || !d.cfg || typeof d.cfg !== 'object') throw new Error('invalid file');
    const c = d.cfg; if (!c.profiles || typeof c.profiles !== 'object') throw new Error('invalid file');
    cfg = { active: c.profiles[c.active] ? c.active : 'default', profiles: c.profiles, global: c.global || {} };
    cfg.profiles.default = cfg.profiles.default || {}; save(); WAT.emit('change', '*');
  };

  /* ---------- registering features ---------- */
  // items: { id, type: toggle|number|text|select|color|textarea|shortcut|action|chats, def, risk: 'low'|'high', global, ... }
  WAT.section = (id, items, order) => {
    let s = WAT.sections.find(x => x.id === id);
    if (!s) { s = { id, items: [], order: order ?? 50 }; WAT.sections.push(s); WAT.sections.sort((a, b) => a.order - b.order); }
    s.items.push(...items); return s;
  };

  /* ---------- i18n ---------- */
  const SUPPORTED = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'tr', 'ja', 'ko', 'zh', 'id', 'pl'];
  WAT.languages = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano', ru: 'Русский', tr: 'Türkçe', ja: '日本語', ko: '한국어', zh: '简体中文', id: 'Bahasa Indonesia', pl: 'Polski' };
  WAT.detectLang = () => {
    const cands = [];
    try { cands.push(document.documentElement.lang); } catch {}
    try { cands.push(...(navigator.languages || [])); cands.push(navigator.language); } catch {}
    for (const c of cands) {
      const base = String(c || '').toLowerCase().split(/[-_]/)[0];
      if (SUPPORTED.includes(base)) return base;
    }
    return 'en';
  };
  WAT.lang = () => {
    const s = WAT.get('language');
    return s && s !== 'auto' && SUPPORTED.includes(s) ? s : WAT.detectLang();
  };
  WAT.t = (key, vars) => {
    const L = WAT.locales;
    let s = (L[WAT.lang()] && L[WAT.lang()][key]) ?? (L.en && L.en[key]) ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : '{' + k + '}'));
    return s;
  };
  WAT.addLocale = (code, dict) => { WAT.locales[code] = Object.assign(WAT.locales[code] || {}, dict); };

  /* ---------- access to WhatsApp internals ---------- */
  WAT.req = name => { try { return typeof window.require === 'function' ? window.require(name) : null; } catch { return null; } };
  WAT.activeChat = () => { try { return WAT.req('WAWebChatCollection').ChatCollection.getActive(); } catch { return null; } };
  WAT.msgs = () => { try { const M = WAT.req('WAWebCollections').Msg; return M.getModelsArray ? M.getModelsArray() : M.models || []; } catch { return []; } };

  /* ---------- network through the extension (CSP-safe) ---------- */
  const pending = new Map();
  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.wat !== 'res') return;
    const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); clearTimeout(p.t); p.res(e.data.res);
  });
  WAT.fetchRaw = (url, headers) => new Promise(res => {
    const id = Math.random().toString(36).slice(2);
    const t = setTimeout(() => { pending.delete(id); res({ error: 'timeout' }); }, 30000);
    pending.set(id, { res, t });
    window.postMessage({ wat: 'req', id, url, headers }, '*');
  });
  const b64ToBytes = b64 => { const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
  WAT.fetchJson = async (url, headers) => {
    const r = await WAT.fetchRaw(url, headers);
    if (r.error) throw new Error(r.error);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return JSON.parse(new TextDecoder().decode(b64ToBytes(r.b64)));
  };
  WAT.fetchBlob = async (url, mime) => {
    const r = await WAT.fetchRaw(url);
    if (r.error) throw new Error(r.error);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return new Blob([b64ToBytes(r.b64)], { type: mime || r.type || 'application/octet-stream' });
  };

  /* ---------- IndexedDB key-value-ish store ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('wat-store', 1);
    r.onupgradeneeded = () => { for (const n of ['msgs', 'statuses', 'sched']) r.result.createObjectStore(n, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const r = fn(s); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => rej(t.error); }); };
  WAT.db = {
    put: (store, rec) => run(store, 'readwrite', s => s.put(rec)),
    get: (store, id) => run(store, 'readonly', s => s.get(id)),
    all: store => run(store, 'readonly', s => s.getAll()),
    del: (store, id) => run(store, 'readwrite', s => s.delete(id)),
    clear: store => run(store, 'readwrite', s => s.clear()),
  };

  /* ---------- quick actions & shortcuts (rendered/handled by ui.js) ---------- */
  WAT.actions = [];
  WAT.addQuickAction = (label, titleKey, fn, showIf) => { WAT.actions.push({ label, titleKey, fn, showIf }); };
  WAT.shortcuts = {};
  WAT.addShortcut = (settingId, fn) => { WAT.shortcuts[settingId] = fn; };

  /* ---------- small DOM helpers ---------- */
  WAT.el = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  WAT.download = (name, text, type) => {
    const a = WAT.el('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' })), download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };
  WAT.nowReady = () => !!(document.body && document.documentElement);
})();
