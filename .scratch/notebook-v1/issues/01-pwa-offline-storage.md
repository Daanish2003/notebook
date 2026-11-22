# PWA offline storage and install over Tailscale

Type: research
Status: resolved
Blocked by:

## Question

What can an installed PWA, served from `https://<machine>.<tailnet>.ts.net` via `tailscale serve`, reliably store offline on iOS Safari, Android Chrome and desktop Chrome/Firefox? Cover storage quotas and eviction rules (especially iOS's 7-day eviction and whether installing changes it), IndexedDB vs OPFS vs Cache Storage for Transcripts (~100 KB each) and Opus audio (~30 MB/hour), `navigator.storage.persist()` behaviour, whether a ts.net cert satisfies install requirements, and Web Share Target support (sharing a YouTube link from the phone into the app).

## Answer

Research: [`research/pwa-offline-storage.md` on branch `research/pwa-offline-storage`](https://github.com/Daanish2003/notebook/blob/research/pwa-offline-storage/research/pwa-offline-storage.md)

- An installed Home Screen web app is exempt from iOS's 7-day storage wipe. It needs "Open as Web App" left on (iOS 26 default), and its storage is separate from Safari's.
- Quotas don't constrain us: about 60% of disk on Chrome and Safari 17+. `navigator.storage.persist()` is granted silently on Chrome and Safari; Firefox prompts.
- Store Transcripts in IndexedDB and audio in OPFS (on iOS before 26, write it from a Worker with `createSyncAccessHandle`). Cache Storage holds the app shell only.
- A `tailscale serve` ts.net certificate is publicly trusted and meets install requirements. The hostname is the origin: renaming the machine or tailnet loses every install and its stored data. Phones need the Tailscale VPN on.
- Web Share Target works only on Chrome/Edge (on Android the link arrives in `text`). There's no support on iOS or Firefox, so a paste-a-link field is needed everywhere.
- Firefox installs web apps on Windows only; on the Linux desktop the app is a normal tab.
