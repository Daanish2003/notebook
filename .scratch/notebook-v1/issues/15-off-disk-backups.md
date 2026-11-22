# Off-disk backups

Type: grilling
Status: claimed
Blocked by:

## Question

Where do backups go besides this disk, and what goes there? Settle: the target (a second internal or USB drive, another machine over Tailscale, a NAS); what is copied (the daily DB snapshots only, or media too, given media is about 22–50 MB per hour of audio and partly re-downloadable); tool and schedule (rsync or restic from a systemd timer, after the daily snapshot); retention; whether to encrypt; and the restore procedure, including how the Owner checks a backup actually restores.
