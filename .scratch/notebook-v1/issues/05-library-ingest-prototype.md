# Library and adding a Source

Type: prototype
Status: resolved
Blocked by: 02

## Question

How does the Owner add Sources and find them again? Prototype the Library home (list or grid, what each Source shows), the add flow (paste URL, upload file, and share-to-app on Android and desktop Chrome; a paste field everywhere, since iOS has no share target), how a Transcription's progress and failures appear, and search across the whole Library. Decide what happens on a duplicate URL, on a failed Transcription (retry or remove), and what the app shows when the Omarchy machine is unreachable (asleep, or off the tailnet).

## Answer

Prototype: [branch `prototype/library`](https://github.com/Daanish2003/notebook/tree/prototype/library). Three variants on the home route, `?variant=A|B|C` and `?scenario=normal|empty|offline`; run with `pnpm prototype`.

**Verdict: Variant C, "Journal", with three changes.** The Owner picked it on 2026-11-22.

- **Layout:** text first. A large search box at the top, then Sources as a timeline grouped by when they were added (Today, Yesterday, This week, Earlier). Each entry shows the title, channel or "Upload", the duration, and Transcript text rather than a thumbnail.
- **Adding:** a composer pinned to the bottom of the screen (within thumb reach on a phone) takes a pasted link, with a paperclip for audio/video files.
  - Change 1: on desktop, a file dropped anywhere on the window also adds it.
  - Share-to-app (Web Share Target) covers Android and desktop Chrome. The paste box covers everything else, including iOS.
- **Progress and failures:** these appear inline as timeline entries ("Waiting", "Downloading n%", "Transcribing n%").
  - Change 2: failed and in-progress Sources also appear in a "needs attention" strip above the timeline until they finish or are retried or removed, so an old failure can't get buried.
  - A failure shows a plain reason and hint per type (private, unavailable, unsupported site, needs login, rate-limited, yt-dlp may be outdated). Retry is offered only for retryable failures (rate-limited, outdated). Remove is always offered.
- **Search:** searches what was said.
  - Change 3: it covers the full Transcript, not only the opening lines. Each hit shows the matching line with its timestamp, and clicking it opens the reader at that moment.
- **Duplicate URL:** a link already in the Library (matched on the YouTube video id or the normalised URL) shows "already here" with the existing Source's title. Sending again transcribes it anyway.
- **Unreachable:** when the Omarchy machine can't be reached, the whole app shows a single "Can't reach omarchy" screen: check Tailscale, be logged in on omarchy, and opening Notebook starts it. It has a Try again button and a "last connected" time. Devices hold no Library data, so there's nothing else to show.
- **Empty Library:** one line inviting the Owner to paste a link below.
