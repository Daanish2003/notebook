# PWA offline storage and install over Tailscale

Research for `.scratch/notebook-v1/issues/01-pwa-offline-storage.md`. Gathered 2026-11-22. Each claim cites its source, with the page's date or version where it has one. Support data comes from `@mdn/browser-compat-data` **8.1.10** (built 2026-11-19), shortened to "BCD" below.

## Question

What can an installed PWA served from `https://<machine>.<tailnet>.ts.net` through `tailscale serve` reliably store offline on iOS Safari, Android Chrome and desktop Chrome/Firefox? This covers:

- quotas and eviction
- IndexedDB vs OPFS vs Cache Storage for Transcripts (~100 KB JSON each) and Opus audio (~30 MB/hour)
- `navigator.storage.persist()`
- whether a ts.net certificate meets the install requirements
- Web Share Target support

## 1. Quotas

Quotas are counted per origin (scheme + host + port). IndexedDB, Cache Storage and OPFS all count against the same per-origin quota. When an origin is evicted, all of its data goes at once. Writes past the quota throw `QuotaExceededError`. Source: [MDN, Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) (last modified 2026-01-05).

| Browser                                                      | Per-origin quota                                                                                              | Whole-browser cap               | Source                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Chrome / Chromium (desktop + Android)                        | up to 60% of total disk, best-effort or persistent                                                            | 80% of disk                     | MDN (above); [web.dev, Storage for the web](https://web.dev/articles/storage-for-the-web) (content updated 2024)               |
| Firefox                                                      | best-effort: the smaller of 10% of disk or 10 GiB per eTLD+1 group. Persistent: up to 50% of disk (8 TiB cap) | n/a                             | MDN                                                                                                                            |
| Safari 17+ / iOS 17+ (browser app _and_ Home Screen web app) | about 60% of total disk. Non-browser apps embedding WebKit get 15%                                            | 80% (browser), 20% (other apps) | [WebKit, Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) (2023-08-10, Safari 17 / iOS 17) |
| Safari before 17                                             | 1 GiB to start, then a permission prompt                                                                      | n/a                             | MDN                                                                                                                            |

The WebKit post says: "a standalone web app has the same origin and overall quotas as in a browser app". web.dev's figure for Safari ("~1 GB, prompts in 200 MB increments") is out of date and was superseded by Safari 17.

Treat `navigator.storage.estimate()` as an upper bound. WebKit warns that the reported quota can change with usage and visit frequency, and that writes must still handle `QuotaExceededError`.

**For Notebook's sizes:** a Transcript is ~100 KB, so 1,000 Transcripts come to ~100 MB. Audio at ~30 MB/hour means 100 hours is ~3 GB. On any modern phone, either fits easily inside 60% of the disk. The real risk is eviction, not quota.

## 2. Eviction

- **Chrome and Firefox:** data is evicted least-recently-used first, and only under storage pressure. Origins marked persistent are skipped. Chrome can also start evicting when all origins together reach 80% of disk. (MDN)
- **Safari: the proactive 7-day rule.** Since iOS/iPadOS 13.4 and Safari 13.1 (2020-03-24), ITP deletes "all of a website's script-writable storage after seven days of Safari use without user interaction on the site". That covers IndexedDB, LocalStorage, SessionStorage, media keys, and Service Worker registrations and cache. Source: [WebKit, Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/). MDN (2026) gives the same rule: no click or tap "in the last seven days of browser use" while cross-site tracking prevention is on.
- **Does a Home Screen install exempt it? In practice, yes.** The same 2020 WebKit post says: "Web applications added to the home screen are not part of Safari and thus have their own counter of days of use." It adds that WebKit does not expect the first party of a Home Screen web app to have its data deleted, and would treat that as a serious bug. web.dev puts it more bluntly: "This eviction policy does not apply to installed PWAs that have been added to the home screen."
  - The counter counts days _the app is used_, not calendar days. Leaving the app unopened for weeks does not run it down.
  - The Home Screen app has **its own storage container**, separate from Safari's (web.dev). Data saved while browsing the site in Safari is not visible inside the installed app, and the reverse is also true.
- **iOS 26 / Safari 26 (2025-09-15):** "By default, every website added to the Home Screen opens as a web app", unless the user turns off "Open as Web App" when adding it. Source: [WebKit, Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). The owner must leave that toggle on. If it is off, the icon opens a Safari tab and the 7-day rule applies again.
- **Safari 17+ also evicts** under storage pressure, when the overall quota is exceeded, or when a site "hasn't been used for some time", least-recently-used first. Origins with an active page or in persistent mode can be excluded. (WebKit 2023)

## 3. `navigator.storage.persist()`

Support (BCD): Chrome/Android 55, Firefox 57, Safari/iOS 15.2.

| Browser                 | How it decides                                                                                                                                                                                   | Source                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Chrome / Android Chrome | No prompt. Granted automatically when the site is installed or bookmarked, has high site engagement, or has notification permission. Otherwise silently denied, and it can be asked again later. | [web.dev, Persistent storage](https://web.dev/articles/persistent-storage) (Pete LePage, undated); MDN |
| Firefox                 | Shows the user a permission popup.                                                                                                                                                               | web.dev; MDN                                                                                           |
| Safari / iOS            | No prompt. Decided by heuristics, "like whether the website is opened as a Home Screen Web App".                                                                                                 | WebKit 2023                                                                                            |

In every browser, an _installed_ PWA is the case most likely to be granted, but Notebook should still call `persist()` and record the result. Firefox Android shows the same prompt as Firefox desktop (MDN describes Firefox's behaviour without splitting by platform). Persistent mode means the data is not cleared under storage pressure. The user can still clear it by hand.

## 4. IndexedDB vs OPFS vs Cache Storage

web.dev's guidance (Storage for the web): use **Cache Storage** for the network resources the app needs to load, **OPFS** for file-like content, and **IndexedDB** for everything else. Avoid localStorage and sessionStorage, which are synchronous and limited to about 5 MiB.

**Transcripts (~100 KB JSON) → IndexedDB.** Each Transcript is a structured record with queryable fields (Source id, updatedAt) that gets read whole. IndexedDB has been supported everywhere for years.

**Opus audio (~30 MB/hour) → OPFS, with IndexedDB Blobs as the fallback.** OPFS support (BCD):

| API                                               | Chrome | Chrome Android | Firefox (desktop + Android) | Safari / iOS |
| ------------------------------------------------- | ------ | -------------- | --------------------------- | ------------ |
| `navigator.storage.getDirectory()`                | 86     | 109            | 111                         | 15.2         |
| `createSyncAccessHandle()` (workers only)         | 102    | 109            | 111                         | 15.2         |
| `createWritable()` (main thread, streaming write) | 86     | 109            | 111                         | **26**       |

MDN describes OPFS as Baseline widely available since March 2023 and limited to secure contexts ([MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), modified 2025-07-14). OPFS shares the origin quota and is erased when site data is cleared.

- On iOS before 26 there is no `createWritable()`. Writing a downloaded file needs a dedicated Worker using `createSyncAccessHandle()`. Safari 26 added the File System WritableStream API (WebKit Safari 26.0 post).
- To play a file, call `fileHandle.getFile()` to get a `File`/Blob, pass it to `URL.createObjectURL()`, and set that URL on `<audio src>`. This avoids service-worker Range handling entirely.
- Storing a Blob in IndexedDB also works and is the simpler fallback.

**Cache Storage → app shell only, not audio.** Serving cached audio through a service worker is awkward ([Chrome Workbox docs, Serving cached audio and video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video)):

- You need `RangeRequestsPlugin`.
- The media element needs the `crossorigin` attribute, even for same-origin files.
- Runtime caching while streaming "won't work", because playback fetches 206 partial responses. The full file has to be added up front.

Cache Storage is the right place for the precached app shell that vite-plugin-pwa/Workbox generates.

On iOS, all three stores fall under the same 7-day rule and the same Home Screen counter. None of them is safer than the others.

## 5. Install requirements and the ts.net certificate

- **The certificate is publicly trusted.** `tailscale cert` and `tailscale serve` get Let's Encrypt certificates for `<machine>.<tailnet>.ts.net` using DNS-01. The private key stays on the machine. Source: [Tailscale, Enabling HTTPS](https://tailscale.com/kb/1153/enabling-https). Because the CA is public, browsers treat the origin as a normal secure context, which is what Chrome install, service workers, OPFS and `persist()` require.
- **Serve:** `tailscale serve 3000` proxies to `http://127.0.0.1:3000`, is reachable only from the tailnet, and provisions the certificate automatically. If HTTPS is not enabled for the tailnet, the CLI enables it. Source: [Tailscale, Serve](https://tailscale.com/kb/1312/serve). Funnel is the public variant and must not be used here. Serve adds `Tailscale-User-*` identity headers, so the backend should listen only on localhost.
- **Chrome install criteria** ([web.dev install criteria](https://web.dev/articles/install-criteria), undated):
  - HTTPS
  - a manifest with `name`/`short_name`, 192 px and 512 px icons, `start_url`, `display` of `standalone`/`fullscreen`/`minimal-ui`, and `prefer_related_applications` not true
  - user engagement: at least one click and 30 s on the page

  Since Chrome 108 (mobile) and 112 (desktop), "Install app" in the menu no longer needs a service worker `fetch` handler. The automatic install prompt still does ([Chrome blog, Revisiting installability criteria](https://developer.chrome.com/blog/update-install-criteria)).

- **vite-plugin-pwa** (docs show v1.2.0) generates the manifest, a Workbox service worker (`generateSW` or `injectManifest`) and the registration code ([guide](https://vite-pwa-org.netlify.app/guide/)). Its [minimal requirements](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html) are:
  - 192 and 512 icons
  - an `apple-touch-icon` (180×180)
  - a `theme-color` meta tag that matches the manifest
  - the manifest served as `application/manifest+json`
  - HTTPS
- **iOS:** any site can be added to the Home Screen as a web app (Safari 26). There is no install-criteria gate.
- **Firefox desktop:** Firefox 143 (2025-09-16) added "web apps" (taskbar tabs) on **Windows only**. macOS and Linux were still "planned" ([Firefox 143 release notes](https://www.firefox.com/en-US/firefox/143.0/releasenotes/)). On the owner's Linux desktop, Firefox runs Notebook as a normal tab with normal best-effort storage (prompted `persist()`).

### Gotchas

- **Certificate Transparency.** Every certificate goes into public CT logs, which reveals the machine's hostname. The tailnet name is randomised, but the machine name is not. "Do not enable the HTTPS feature if any of your machine names contain sensitive information." Rename the machine first if you need to. (Tailscale, Enabling HTTPS)
- **MagicDNS is mandatory for HTTPS**, and HTTPS works only on the full ts.net name, never on the bare `https://machine`. Changing the tailnet DNS name later, or turning HTTPS off, breaks the origin. That means a _new origin_, so all PWA data and the install are lost. (Tailscale, Enabling HTTPS)
- **Certificate renewal:** Let's Encrypt certificates last 90 days. Files made with plain `tailscale cert` must be renewed by hand. Tailscale's docs don't say whether `serve` renews automatically. _Unverified:_ in practice tailscaled manages serve certificates itself. Watch the expiry during v1.
- **Phones must have the Tailscale VPN connected** to resolve and reach the ts.net name. An offline-first PWA can still open from its cache when the VPN is off; sync just fails. Android's **Private DNS** setting is widely reported to conflict with Tailscale's DNS. Those reports are community/forum sources, not official Tailscale docs: [forum thread](https://forum.tailscale.com/t/cant-use-magic-dns-or-tailscale-with-android-private-dns-for-name-resolution/3570). Tailscale's official troubleshooting page mentions only DNS-rebinding protection on ISP/corporate resolvers ([Can't resolve domain names](https://tailscale.com/docs/reference/troubleshooting/resolve-domain-names-failure.md)). If names fail on Android, turn Private DNS off.

## 6. Web Share Target (sharing a YouTube link into the PWA)

Support for `share_target` (BCD):

| Platform               | Support                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Chrome Android         | **76+**                                                                                                         |
| Chrome / Edge desktop  | **89+**                                                                                                         |
| Firefox (desktop)      | no ([bug 1476515](https://bugzil.la/1476515))                                                                   |
| Firefox Android        | no ("the property parses, but has no effect")                                                                   |
| Safari macOS / **iOS** | **no** ([WebKit bug 194593](https://webkit.org/b/194593)), and no mention of it in the Safari 26.0 release post |

Requirements and behaviour ([Chrome docs, Web Share Target](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target); [MDN share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target), modified 2026-08-27, "Limited availability / experimental"):

- The PWA must be **installed** and meet Chrome's install criteria.
- Links can use `method: "GET"`. The `action` page reads `title`/`text`/`url` from the query string. Precache that page so it opens offline.
- **On Android the `url` field is empty**, because Android's share intents have no URL field. The link arrives in `text`, sometimes in `title`. The app has to pull the URL out of `text`.

**iOS has no Web Share Target.** A PWA cannot appear in the iOS share sheet. Workarounds, none of them first-party PWA features:

1. Copy the link and paste it into Notebook. An "Add from clipboard" button covers this.
2. _Unverified suggestion:_ an Apple Shortcuts share-sheet shortcut that opens `https://<machine>.<tailnet>.ts.net/share?text=<input>`. It would probably open in Safari rather than the installed app, but the server-side add still works, because the server is the source of truth.

## Implications for Notebook

- **iOS needs the Home Screen install with "Open as Web App" left on.** In a plain Safari tab, offline data gets wiped after 7 days of Safari use without visiting. Installed, the app has its own container and its own use-counter, and WebKit treats losing the app's data as a bug. Tell the owner to always open Notebook from the icon, because Safari-tab data is a separate store.
- **Call `navigator.storage.persist()` on first run** and show the result (and `estimate()`) on a settings/storage screen. It is likely granted for installed apps on Chrome and iOS. On Firefox it is a prompt the owner can accept.
- **Store Transcripts in IndexedDB.** At ~100 KB each, the full Library fits on every device, so caching all Transcripts offline is realistic.
- **Store audio in OPFS, opt-in per Source.** Write it from a Worker with `createSyncAccessHandle()` so it works on iOS before 26 as well, and play it through a Blob URL. Don't put audio in the service worker's Cache Storage, because of the Range/206 problem. At ~30 MB/hour, audio should be "download for offline" per Source rather than everything automatically. YouTube Sources play through the embed and can't be offline at all.
- **The client store is a cache, not the source of truth.** The Omarchy machine stays authoritative (standing decision). Any device can lose its store (eviction, origin change, the user clearing data) and re-sync. Don't build features that depend on client-only data.
- **Pick the machine name and tailnet name once, before first install.** The ts.net hostname _is_ the origin: renaming it orphans every installed PWA and all its data, and the name is published in CT logs. Serve with `tailscale serve` (tailnet-only, never Funnel) and bind Hono to localhost.
- **Sharing:** add a GET `share_target` that parses the URL out of `text`. It works on Android Chrome and desktop Chrome/Edge. iOS has no share target, so ship a paste-a-link field, and optionally document a Shortcuts workaround.
- **Firefox on Linux can't install the app.** It works as a regular tab with best-effort storage, which is fine for the desktop where the server lives anyway.
