# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's *Report a vulnerability* (Security tab →
Advisories) on this repository, or contact the maintainer privately through their GitHub profile.

## Scope

In scope: the extension (`extension/`), the installer scripts (`installer/`) and the update mechanism.
Out of scope: vulnerabilities in WhatsApp itself, Windows, or third-party services.

## Things worth knowing

- The project is experimental and AI-assisted; audit before use.
- The extension only talks to `api.klipy.com`, `static*.klipy.com` and `api.github.com` (allow-list in
  `extension/background.js` and `manifest.json`).
- The updater verifies the SHA-256 of the downloaded release against `checksums.txt` from the same release.
- The PIN lock is a screen cover, not encryption.
