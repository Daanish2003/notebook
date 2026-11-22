# Running Notebook always-on

Type: grilling
Status: resolved
Blocked by:

## Question

How does Notebook run day to day on the Omarchy machine? Settle: systemd user units for the server and worker (start on login or at boot, restart policy, logs), the `tailscale serve` config and which ports bind where, where the SQLite file and media live (a path outside the repo, e.g. `~/.local/share/notebook`), backups, what happens to queued work while the machine sleeps, and whether the worker should yield the GPU while voxtype is in use.

## Answer

Decided with the Owner (grilling, 2026-11-22). Facts checked first: the machine is a desktop that never auto-suspends (idle only locks the screen). Linger is off. Tailscale is installed but logged out. Ports 3000–3005 and 5432 are taken by other projects. voxtype holds 3.3 GB of VRAM and the worker about 5 GB, out of 12 GB.

1. **Start at boot.** Run `loginctl enable-linger`, and run two systemd user services, `notebook-server` and `notebook-transcriber`, with `Restart=on-failure`. They come up after a reboot without anyone logging in.
2. **One port, one process.** In production, Hono serves the built web app and the API from `127.0.0.1:4310`, the only port, bound to localhost. In development, Vite and the server run separately on other ports.
3. **Address:** `https://omarchy.<tailnet>.ts.net/`, via `tailscale serve --bg http://127.0.0.1:4310` on HTTPS 443, at the root. Never Funnel. The Tailscale machine name is `omarchy`, set with `tailscale set --hostname=omarchy`; the OS hostname stays `daanish`. The tailnet name must be final before any device installs the PWA.
4. **Library location.** The always-on Library is `~/.local/share/notebook/` (`notebook.db`, `media/`, `backups/`). Development uses the repo's `./data/`, so it never touches the real Library.
5. **Backups.** A daily systemd timer takes a SQLite `.backup` snapshot into `~/.local/share/notebook/backups/` and keeps the latest 14. This protects against corruption and bad migrations, not disk failure.
6. **GPU sharing.** The worker runs alongside voxtype with `Nice=10`. There is no GPU handoff; both fit in VRAM.
7. **Shipping and logs.** `pnpm deploy:local` builds and restarts both services. Logs go to journald: `journalctl --user -u 'notebook-*'`.
8. **yt-dlp upkeep.** A weekly timer upgrades only yt-dlp in the worker's uv environment and restarts the worker. When a download fails with an extractor error, the worker reports "yt-dlp may be outdated".

**Before the first device installs the PWA** (Owner, by hand): log in to Tailscale, run `tailscale set --hostname=omarchy`, enable MagicDNS and HTTPS certificates, and rename the tailnet in the admin console if you want a different name. Never change either name afterwards.
