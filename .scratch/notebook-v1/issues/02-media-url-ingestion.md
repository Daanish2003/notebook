# Media URL ingestion and synced playback

Type: research
Status: open
Blocked by:

## Question

For a media URL, what does `yt-dlp` give us and what does playback need? Cover: audio-only download flags, the metadata available (title, channel, thumbnail, duration, upload date, chapters, existing subtitles), failure modes (private, age-restricted, live, playlists, rate limits), and how YouTube's IFrame Player API exposes current time for highlighting the active Segment (how precise, how often, and does seeking work). For non-YouTube sites without an embeddable player, is playing our own downloaded Opus copy the right fallback?
