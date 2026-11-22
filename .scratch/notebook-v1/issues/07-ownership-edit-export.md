# Editing and Export

Type: grilling
Status: resolved
Blocked by: 06

## Question

Can the Owner correct a Transcript's text (fix misheard words, rename the Source), and if so how do edits interact with Segment timings and re-transcription? An Export is a download to the requesting device: which formats does it offer (Markdown with front matter and timestamp links, SRT/VTT, plain text), is it one Transcript or a selection or the whole Library (zip), and does it include the audio?

## Answer

Decided with the Owner (grilling, 2026-11-22), ahead of its blocker at the Owner's request. The table shapes it relies on are in "Data model and media layout".

**Editing (v1):**

- The Owner can rename a Source and edit a Segment's text in place.
- An edited Segment keeps `start_ms`/`end_ms`, gets `edited_at` set, and has its `words` cleared, so highlighting falls back to the whole Segment. Its search entry is updated.
- Re-transcribing a Source warns that edits will be lost, then replaces all its Segments.

**Export of one Source**, downloaded to the requesting device, in four formats:

- **Markdown** (the default): front matter with title, URL, channel, duration and upload date, then paragraphs grouped by the reader's rules. Each paragraph starts with a `[mm:ss]` timestamp, which for YouTube Sources links to that moment (`&t=`). YouTube chapters, when present, become headings.
- **SRT** and **VTT**: one cue per Segment.
- **Plain text**.

Exports use edited text where the Owner made corrections.

**Export Library:** a zip with one Markdown file per Source, excluding Recently deleted Sources. Audio is excluded by default, with a checkbox to include it. It doubles as a portable backup on any device.
