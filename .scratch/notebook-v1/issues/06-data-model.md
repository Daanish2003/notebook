# Data model and media layout

Type: grilling
Status: open
Blocked by: 03, 04

## Question

What are the tables and files? Settle: the Source, Transcript, Segment and Transcription fields; whether word timings are stored per Segment (jsonb/JSON) or in their own table; the FTS5 setup for Library-wide and in-Transcript search (a hit must return the Source, the matching Segment and its timestamp, for "Library and adding a Source"); how the Python worker claims and updates Transcriptions in SQLite (WAL, polling interval, crash recovery); and the on-disk media layout and cleanup, and which yt-dlp metadata fields become columns. (Settled by the Owner: URL Sources keep their downloaded audio too.)
