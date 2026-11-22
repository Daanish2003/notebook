// PROTOTYPE (throwaway): in-memory Library for the "Library and adding a Source" ticket.
// No server, no persistence. Adding a Source simulates the Transcription stages.
import { useCallback, useEffect, useRef, useState } from "react";

export type Stage = "queued" | "downloading" | "transcribing" | "done" | "failed";

export type FailureKind =
  | "private"
  | "unavailable"
  | "unsupported"
  | "login"
  | "rate-limited"
  | "outdated";

export type Source = {
  id: string;
  kind: "youtube" | "url" | "upload";
  title: string;
  channel: string | null;
  url: string | null;
  durationSec: number | null;
  addedAt: number;
  stage: Stage;
  progress: number; // 0..1 within the current stage
  failure?: FailureKind;
  snippet?: string; // first words of the Transcript
  hue: number; // placeholder thumbnail colour
};

export const failureCopy: Record<FailureKind, { title: string; hint: string; retry: boolean }> = {
  private: { title: "This video is private", hint: "Only the uploader can see it.", retry: false },
  unavailable: { title: "Video unavailable", hint: "It may have been removed.", retry: false },
  unsupported: {
    title: "Not a media link",
    hint: "yt-dlp doesn't support this site.",
    retry: false,
  },
  login: {
    title: "Needs a login",
    hint: "This site only allows signed-in downloads.",
    retry: false,
  },
  "rate-limited": { title: "YouTube is rate-limiting", hint: "Try again in an hour.", retry: true },
  outdated: {
    title: "Download failed",
    hint: "yt-dlp may be outdated; it updates weekly.",
    retry: true,
  },
};

const HOUR = 3_600_000;
const now = Date.now();

const seed: Source[] = [
  {
    id: "s1",
    kind: "youtube",
    title: "The Unreasonable Effectiveness of Recurrent Neural Networks — talk",
    channel: "ML Conference 2025",
    url: "https://www.youtube.com/watch?v=aaaa",
    durationSec: 3412,
    addedAt: now - 0.2 * HOUR,
    stage: "transcribing",
    progress: 0.42,
    hue: 210,
  },
  {
    id: "s2",
    kind: "upload",
    title: "standup-2026-11-21.m4a",
    channel: null,
    url: null,
    durationSec: 912,
    addedAt: now - 0.1 * HOUR,
    stage: "queued",
    progress: 0,
    hue: 30,
  },
  {
    id: "s3",
    kind: "youtube",
    title: "How SQLite Is Tested",
    channel: "Database Talks",
    url: "https://www.youtube.com/watch?v=bbbb",
    durationSec: 2710,
    addedAt: now - 3 * HOUR,
    stage: "done",
    progress: 1,
    snippet:
      "So the question I get asked most often is how do we know SQLite actually works, and the answer is that we test it more than almost any other piece of software…",
    hue: 140,
  },
  {
    id: "s4",
    kind: "url",
    title: "Episode 214: Local-first software",
    channel: "The Changelog",
    url: "https://changelog.com/podcast/214",
    durationSec: 5480,
    addedAt: now - 26 * HOUR,
    stage: "done",
    progress: 1,
    snippet:
      "Welcome back to the show. Today we're talking about local-first software, the idea that your data should live on your devices first and the cloud second…",
    hue: 280,
  },
  {
    id: "s5",
    kind: "youtube",
    title: "Members-only Q&A",
    channel: "Some Creator",
    url: "https://www.youtube.com/watch?v=cccc",
    durationSec: null,
    addedAt: now - 30 * HOUR,
    stage: "failed",
    progress: 0,
    failure: "login",
    hue: 0,
  },
  {
    id: "s6",
    kind: "youtube",
    title: "Me at the zoo",
    channel: "jawed",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    durationSec: 19,
    addedAt: now - 5 * 24 * HOUR,
    stage: "done",
    progress: 1,
    snippet:
      "Alright, so here we are, one of the elephants. The cool thing about these guys is that they have really, really, really long trunks…",
    hue: 90,
  },
  {
    id: "s7",
    kind: "upload",
    title: "lecture-07-distributed-systems.mp4",
    channel: null,
    url: null,
    durationSec: 4820,
    addedAt: now - 9 * 24 * HOUR,
    stage: "done",
    progress: 1,
    snippet:
      "Last time we talked about clocks. Today: consensus, and why it's so much harder than it looks when machines can fail at any moment…",
    hue: 330,
  },
  {
    id: "s8",
    kind: "youtube",
    title: "Building a GPU-accelerated speech pipeline",
    channel: "Systems Weekly",
    url: "https://www.youtube.com/watch?v=dddd",
    durationSec: 1980,
    addedAt: now - 1.5 * HOUR,
    stage: "failed",
    progress: 0,
    failure: "outdated",
    hue: 180,
  },
];

export function useLibrary(empty: boolean) {
  const [sources, setSources] = useState<Source[]>(empty ? [] : seed);
  const timer = useRef<number | undefined>(undefined);

  // Advance any in-flight Transcription every 400ms.
  useEffect(() => {
    timer.current = window.setInterval(() => {
      setSources((list) =>
        list.map((s) => {
          if (s.stage === "done" || s.stage === "failed") return s;
          const step = s.stage === "queued" ? 0.5 : s.stage === "downloading" ? 0.2 : 0.06;
          const p = s.progress + step;
          if (p < 1) return { ...s, progress: p };
          if (s.stage === "queued")
            return {
              ...s,
              stage: s.kind === "upload" ? "transcribing" : "downloading",
              progress: 0,
            };
          if (s.stage === "downloading") return { ...s, stage: "transcribing", progress: 0 };
          return {
            ...s,
            stage: "done",
            progress: 1,
            snippet: "Transcript ready. This is where the first lines would appear…",
          };
        }),
      );
    }, 400);
    return () => window.clearInterval(timer.current);
  }, []);

  const findDuplicate = useCallback(
    (url: string) => sources.find((s) => s.url && normalise(s.url) === normalise(url)),
    [sources],
  );

  const addUrl = useCallback((url: string) => {
    const failure: FailureKind | undefined = /playlist|list=/.test(url)
      ? "unsupported"
      : /private/.test(url)
        ? "private"
        : undefined;
    setSources((list) => [
      {
        id: crypto.randomUUID(),
        kind: /youtu\.?be/.test(url) ? "youtube" : "url",
        title: failure ? url : `New Source from ${new URL(url).hostname}`,
        channel: null,
        url,
        durationSec: failure ? null : 1500,
        addedAt: Date.now(),
        stage: failure ? "failed" : "queued",
        progress: 0,
        failure,
        hue: Math.floor(Math.random() * 360),
      },
      ...list,
    ]);
  }, []);

  const addFile = useCallback((name: string) => {
    setSources((list) => [
      {
        id: crypto.randomUUID(),
        kind: "upload",
        title: name,
        channel: null,
        url: null,
        durationSec: 1200,
        addedAt: Date.now(),
        stage: "queued",
        progress: 0,
        hue: Math.floor(Math.random() * 360),
      },
      ...list,
    ]);
  }, []);

  const retry = useCallback((id: string) => {
    setSources((list) =>
      list.map((s) =>
        s.id === id ? { ...s, stage: "queued", progress: 0, failure: undefined } : s,
      ),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setSources((list) => list.filter((s) => s.id !== id));
  }, []);

  return { sources, findDuplicate, addUrl, addFile, retry, remove };
}

function normalise(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]{6,})/);
  return m ? `yt:${m[1]}` : url.replace(/\/$/, "");
}

export function isUrl(text: string) {
  try {
    const u = new URL(text.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function fmtDuration(sec: number | null) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtAgo(ts: number) {
  const min = Math.round((Date.now() - ts) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function stageLabel(s: Source) {
  switch (s.stage) {
    case "queued":
      return "Waiting";
    case "downloading":
      return `Downloading ${Math.round(s.progress * 100)}%`;
    case "transcribing":
      return `Transcribing ${Math.round(s.progress * 100)}%`;
    case "done":
      return "Ready";
    case "failed":
      return s.failure ? failureCopy[s.failure].title : "Failed";
  }
}

export function matches(s: Source, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [s.title, s.channel ?? "", s.snippet ?? ""].some((f) => f.toLowerCase().includes(t));
}
