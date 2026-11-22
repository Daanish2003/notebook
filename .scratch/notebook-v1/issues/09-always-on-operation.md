# Running Notebook always-on

Type: grilling
Status: open
Blocked by:

## Question

How does Notebook run day to day on the Omarchy machine? Settle: systemd user units for the server and worker (start on login or at boot, restart policy, logs), the `tailscale serve` config and which ports bind where, where the SQLite file and media live (a path outside the repo, e.g. `~/.local/share/notebook`), backups, what happens to queued work while the machine sleeps, and whether the worker should yield the GPU while voxtype is in use.
