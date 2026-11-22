# PWA offline storage and install over Tailscale

Type: research
Status: open
Blocked by:

## Question

What can an installed PWA, served from `https://<machine>.<tailnet>.ts.net` via `tailscale serve`, reliably store offline on iOS Safari, Android Chrome and desktop Chrome/Firefox? Cover storage quotas and eviction rules (especially iOS's 7-day eviction and whether installing changes it), IndexedDB vs OPFS vs Cache Storage for Transcripts (~100 KB each) and Opus audio (~30 MB/hour), `navigator.storage.persist()` behaviour, whether a ts.net cert satisfies install requirements, and Web Share Target support (sharing a YouTube link from the phone into the app).
