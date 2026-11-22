# Reader layout

Type: prototype
Status: resolved
Blocked by: 03

## Question

How should a Transcript read, on phone and on desktop? Prototype with real Segments from "What onnx-asr output looks like as readable text": paragraph grouping, timestamp placement, the player (where it sits, whether it sticks on mobile), highlighting the active Segment during playback, click-to-seek, find-in-transcript, typography and reading width, and dark/light themes. Decide what the reader shows, and what it deliberately leaves out, for v1.

## Answer

Prototype: [branch `prototype/reader`](https://github.com/Daanish2003/notebook/tree/prototype/reader). Route `/prototype/reader?variant=A|B|C&scenario=lecture|podcast`; run with `pnpm prototype`. Sync and click-to-seek were verified in Chrome against the YouTube embed and a local audio file.

**Verdict: Variant A, "Article", with B's search list and C's phone dock.** The Owner picked it on 2026-11-22.

- **Reading column:** a serif body of about 68 characters per line, at roughly 1.15 rem with 1.75 line height. Paragraphs follow the research rules. Each paragraph's start timestamp sits in the left margin on desktop and seeks when clicked.
- **Chapters:** shown as inline headings, plus an **Outline** button that lists the chapters as jump targets. When a Source has no chapters, the Outline lists paragraph starts instead.
- **Player:**
  - Desktop: a slim sticky top bar with back, play/pause, title, current time, find, and a show/hide video toggle. Video is hidden by default; audio-only Sources never show it.
  - Phone, borrowed from C: a bottom dock with play/pause, skip ±10 s, the current time, and a scrubber with a tick at each paragraph start.
- **Following along:**
  - The spoken word gets a subtle highlight, which confirms word-level highlighting and therefore storing word timings.
  - "Follow along" is on by default: the view auto-scrolls to keep the active word centred, and pauses while the Owner scrolls by hand.
  - Clicking any word seeks to it.
- **Find in transcript**, borrowed from B: it lists every hit with its timestamp and an excerpt, and tapping one jumps there and highlights the hit. It behaves the same way as Library search.
- **Fillers:** "uh/um" are hidden by default (punctuation and capitals repaired), with a toggle to show them.
- **Uncertain words** (low model confidence) get a faint dotted underline, marking likely misheard names to fix with in-place editing.
- **Left out on purpose:** an always-visible large video, and a focus/karaoke mode.
