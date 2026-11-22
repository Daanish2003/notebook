# Off-disk backups

Type: grilling
Status: resolved
Blocked by:

## Question

Where do backups go besides this disk, and what goes there? Settle: the target (a second internal or USB drive, another machine over Tailscale, a NAS); what is copied (the daily DB snapshots only, or media too, given media is about 22–50 MB per hour of audio and partly re-downloadable); tool and schedule (rsync or restic from a systemd timer, after the daily snapshot); retention; whether to encrypt; and the restore procedure, including how the Owner checks a backup actually restores.

## Answer

Decided with the Owner (grilling, 2026-11-22; recommendations accepted). Fact checked: the desktop has a single NVMe drive, `rsync` is installed, `restic` isn't, and Tailscale is logged out, so other devices weren't visible.

- **Target:** the Owner's laptop, over Tailscale. Backups land whenever the laptop is online. If the laptop turns out to lack room, fall back to a USB drive. The laptop's OS, path and free space get confirmed during implementation.
- **What:** the daily SQLite snapshots _and_ `media/`. Only changes are sent, so after the first run a week of new Sources is small. URL media can disappear from the web, so it's worth keeping.
- **Tool:** restic (encrypted, deduplicating, dated snapshots), run by a systemd timer right after the daily DB snapshot, over SFTP or restic's REST server on the tailnet.
- **Laptop offline:** the backup retries on the next run, and the app shows a warning when the last off-disk backup is more than 7 days old.
- **Password:** the restic password lives in a file only the Owner can read (`~/.config/notebook/restic-password`), with a copy in the Owner's password manager. Without it, the backups can't be opened.
- **Retention:** `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune`.
- **Proving restores:** a monthly `restic check --read-data-subset 5%`, a documented one-command restore, and a "last verified" date in the app.
