# Architecture

## The short version

```
Windows policy (HKCU\...\WebView2\AdditionalBrowserArguments, value "WhatsApp.Root.exe")
        │  --load-extension="%USERPROFILE%\WaDesktop-Tweaks\extension"
        ▼
WhatsApp Desktop (WinUI shell) ── hosts ──► WebView2 ──► https://web.whatsapp.com
                                              │
                      unpacked MV3 extension ─┤  bridge.js    (isolated world: relays requests)
                                              │  background.js (service worker: allow-listed fetches)
                                              └─ core.js … ui.js (MAIN world: runs next to WhatsApp's code)
```

There is **no** helper process, **no** debugging port and **no** modification of WhatsApp's files.

## Why a browser extension?

WhatsApp Desktop for Windows is a native shell around WhatsApp Web inside WebView2. The interface (and everything these
tweaks care about) is JavaScript downloaded from `web.whatsapp.com`, so it cannot be changed by patching the installed
binaries — they are signed MSIX packages, and the feature code is not in them anyway.

Chromium can load an unpacked extension from a command-line flag. WebView2 lets you add command-line flags for a given
executable through a policy value, and WhatsApp's host starts its WebView2 with extensions enabled
(`--embedded-browser-webview-enable-extension`). Recent Chromium builds ignore `--load-extension` unless the feature
`DisableLoadExtensionCommandLineSwitch` is disabled, hence the second flag.

## Why administrator, and only to install?

The policy value lives under `HKCU\Software\Policies`, which Windows restricts to administrators even within your own
user hive. Updating only replaces files in `%USERPROFILE%\WaDesktop-Tweaks\extension` (a path the policy already
points to), so it needs no elevation.

## Pieces

| File | World | Role |
|---|---|---|
| `manifest.json` | – | MV3 manifest; lists scripts and the few allowed hosts |
| `background.js` | extension | Service worker. Performs fetches the page may not make (WhatsApp's CSP blocks 3rd-party hosts). Only URLs matching an allow-list are served |
| `bridge.js` | isolated | Relays `window.postMessage` requests from the page to the service worker and back |
| `core.js` | MAIN | Namespace `WAT`, settings & profiles, i18n, IndexedDB helpers |
| `features/*.js` | MAIN | One file per feature group; each registers its settings with `WAT.section(...)` |
| `ui.js` | MAIN | Settings panel, dialogs, toasts, header buttons, keyboard shortcuts |
| `locales/*.js` | MAIN | One dictionary per language (`WAT.addLocale(code, {...})`) |

### How features hook into WhatsApp

The scripts run in the page's own JavaScript world, where WhatsApp's module loader is available as `window.require`.
Features resolve a few named modules (for example the read-receipt job or the chat-state bridge) and wrap specific
functions. Message events come from WhatsApp's own `Msg` collection. Nothing is sent to any server except what
WhatsApp itself would have sent.

Because these are WhatsApp's **internal** names, they can change in any update. The **Self-diagnosis** screen checks
that each hook is still present so users (and maintainers) can see what broke.

### Language-independent detection

Features avoid matching WhatsApp's translated texts. They use model fields (`msg.type`, `msg.isForwarded`, …),
`data-testid` / `data-icon` attributes and DOM structure. Where a position is used (side-bar items) it relies on
`data-navbar-item-index`.

### Data

All local data lives in the page's origin storage (localStorage + IndexedDB `wat-store`). Recovered messages keep text
and thumbnails only; "view once" messages and media files are never stored (except statuses, if explicitly enabled).

## Threat model & limits

- The extension runs with full access to the WhatsApp Web page. Review the code; releases publish a SHA-256
  checksum and the updater verifies it.
- The PIN lock is a visual cover; anyone with access to your Windows account can bypass it.
- A malicious program already running as your user could edit the extension files; the same is true of any
  per-user software.
