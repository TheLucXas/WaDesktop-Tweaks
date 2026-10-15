# Contributing

Thanks for helping! This is a small, AI-assisted community project. All contributions are welcome — especially
**translation fixes**.

## Branches

- `main` — released code. Releases are tagged from here.
- `dev` — work in progress. Open pull requests against `dev`.

## Translations

Each language is one file in `extension/locales/` (`en.js`, `es.js`, …):

```js
window.WAT && window.WAT.addLocale('xx', {
  'f.deferRead.name': 'Name of the option',
  'f.deferRead.desc': 'One-line description',
  'f.deferRead.tip':  'Longer tooltip explaining exactly what it does',
});
```

- `en.js` is the source of truth. Keep the same keys in every file.
- Right-to-left languages (Arabic, Hebrew) are not supported yet because they would need a mirrored layout.
- To add a language: copy `en.js`, translate, add its code to `SUPPORTED` / `WAT.languages` in `core.js`, and list the
  new file in `manifest.json`.

## Code

- Plain JavaScript, no build step. Run `node --check` on the files you touch.
- Don't match WhatsApp's translated strings; use model fields and `data-*` attributes (see `docs/ARCHITECTURE.md`).
- Anything that changes what is sent to WhatsApp or automates actions needs a `risk` flag on its setting
  (`'low'` or `'high'`) so the ⚠️ marker and tooltip appear.
- **Never commit** API keys, tokens, personal paths, chat content or screenshots with private data.

## Reporting a problem

Open an issue and paste the report from **Settings & updates → Self-diagnosis → Copy report**, plus your WhatsApp
Desktop version and Windows version.
