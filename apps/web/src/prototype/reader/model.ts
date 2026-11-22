// PROTOTYPE (throwaway): Transcript model + player for the "Reader layout" ticket.
// Data are real onnx-asr outputs from the segment-shape research (first 10 min of MIT 6.006
// lecture 1; a 4-min NASA podcast clip). Paragraph breaks come precomputed in the JSON (`at`).
import { useCallback, useEffect, useRef, useState } from "react";

import lecture from "./data/mit-6006-lecture1.json";
import podcast from "./data/nasa-hwhap-artemis-flight-directors.json";

type RawWord = { w: string; start: number; end: number; p: number };
type RawSeg = { idx: number; start: number; end: number; text: string; words: RawWord[] };
type Raw = {
  source: { title: string; url: string };
  paragraphs: { start: number; end: number; at: [number, number] }[];
  segments: RawSeg[];
};

export type Word = {
  i: number; // global index
  w: string;
  start: number;
  end: number;
  p: number;
  seg: number;
  filler: boolean;
};
export type Paragraph = { start: number; end: number; words: Word[] };

export type Sample = {
  key: "lecture" | "podcast";
  title: string;
  channel: string;
  youtubeId: string;
  /** Seconds to add to transcript times to get media time (the podcast clip starts at 10:00). */
  offset: number;
  playback: "youtube" | "audio";
  audioSrc?: string;
  words: Word[];
  paragraphs: Paragraph[];
  chapters: { title: string; start: number }[];
};

const FILLERS = new Set(["uh", "um", "er", "ah", "hmm", "mm", "erm"]);

function build(raw: Raw): { words: Word[]; paragraphs: Paragraph[] } {
  const words: Word[] = [];
  const firstWordOfSeg: number[] = [];
  for (const s of raw.segments) {
    firstWordOfSeg[s.idx] = words.length;
    for (const w of s.words) {
      words.push({
        ...w,
        i: words.length,
        seg: s.idx,
        filler: FILLERS.has(w.w.replace(/[^\w]/g, "").toLowerCase()),
      });
    }
  }
  const starts = raw.paragraphs.map(({ at }) => (firstWordOfSeg[at[0]] ?? 0) + at[1]);
  const paragraphs = starts.map((from, k) => {
    const ws = words.slice(from, starts[k + 1] ?? words.length);
    return { start: ws[0]?.start ?? 0, end: ws.at(-1)?.end ?? 0, words: ws };
  });
  return { words, paragraphs };
}

export const samples: Record<Sample["key"], Sample> = {
  lecture: {
    key: "lecture",
    title: "Lecture 1: Algorithms and Computation",
    channel: "MIT OpenCourseWare · 6.006 Spring 2020",
    youtubeId: "ZA-tUyM_y7s",
    offset: 0,
    playback: "youtube",
    ...build(lecture as unknown as Raw),
    // Pretend chapters, to see how sections read. Real ones come from yt-dlp `chapters`.
    chapters: [
      { title: "Welcome and course staff", start: 12.8 },
      { title: "What is an algorithm?", start: 197.56 },
      { title: "Correctness and efficiency", start: 406.8 },
    ],
  },
  podcast: {
    key: "podcast",
    title: "Houston We Have a Podcast: Artemis Flight Directors",
    channel: "NASA · clip 10:00–14:00",
    youtubeId: "ZC4hpgNoumQ",
    offset: 600,
    playback: "audio",
    audioSrc: "/prototype-media/nasa.m4a",
    ...build(podcast as unknown as Raw),
    chapters: [],
  },
};

/** Render a paragraph's words as text tokens, optionally dropping fillers and fixing up punctuation. */
export function visibleWords(words: Word[], hideFillers: boolean): { word: Word; text: string }[] {
  const out: { word: Word; text: string }[] = [];
  let capitalizeNext = false;
  for (const word of words) {
    if (hideFillers && word.filler) {
      // "Um." ends a sentence → capitalise the next word; "uh," just disappears.
      if (/[.?!]$/.test(word.w)) capitalizeNext = true;
      continue;
    }
    let text = word.w;
    if (capitalizeNext || (out.length === 0 && hideFillers)) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
      capitalizeNext = false;
    }
    out.push({ word, text });
  }
  return out;
}

export function fmt(t: number) {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Index of the word being spoken at transcript time t (binary search on starts). */
export function activeWordIndex(words: Word[], t: number) {
  let lo = 0;
  let hi = words.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((words[mid]?.start ?? 0) <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

// ---------------------------------------------------------------- player

type YTPlayer = {
  getCurrentTime(): number;
  seekTo(s: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  destroy(): void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady: Promise<void> | null = null;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.append(s);
  });
  return ytReady;
}

/**
 * One player API for both playback kinds. Mount `mountRef` on the element the variant wants the
 * video (or audio) to live in. `time` is in transcript time (media time minus the sample offset).
 */
export function usePlayer(sample: Sample) {
  const mountRef = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const seekTarget = useRef<{ t: number; until: number } | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    if (sample.playback === "youtube") {
      const host = document.createElement("div");
      el.append(host);
      void loadYT().then(() => {
        if (cancelled || !window.YT) return undefined;
        yt.current = new window.YT.Player(host, {
          videoId: sample.youtubeId,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onStateChange: (e: { data: number }) => setPlaying(e.data === 1),
          },
        });
        return undefined;
      });
    } else {
      const a = document.createElement("audio");
      a.src = sample.audioSrc ?? "";
      a.preload = "auto";
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("loadedmetadata", () => {
        a.currentTime = sample.offset;
      });
      audio.current = a;
      el.append(a);
    }
    return () => {
      cancelled = true;
      yt.current?.destroy();
      yt.current = null;
      audio.current?.pause();
      audio.current = null;
      el.replaceChildren();
    };
  }, [sample]);

  // Poll the media clock. YouTube has no timeupdate event, so poll both the same way.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const media = yt.current?.getCurrentTime?.() ?? audio.current?.currentTime ?? sample.offset;
      const st = seekTarget.current;
      // Right after seekTo, YouTube still reports the old time for a moment: trust the target.
      const t = st && performance.now() < st.until ? st.t : media - sample.offset;
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sample]);

  const seek = useCallback(
    (t: number, play = true) => {
      seekTarget.current = { t, until: performance.now() + 400 };
      const media = t + sample.offset;
      if (yt.current) {
        yt.current.seekTo(media, true);
        if (play) yt.current.playVideo();
      } else if (audio.current) {
        audio.current.currentTime = media;
        if (play) void audio.current.play();
      }
    },
    [sample],
  );

  const toggle = useCallback(() => {
    if (yt.current) {
      if (yt.current.getPlayerState() === 1) yt.current.pauseVideo();
      else yt.current.playVideo();
    } else if (audio.current) {
      if (audio.current.paused) void audio.current.play();
      else audio.current.pause();
    }
  }, []);

  return { mountRef, time, playing, seek, toggle };
}

export function useSample() {
  const k = new URLSearchParams(window.location.search).get("source");
  return samples[k === "podcast" ? "podcast" : "lecture"];
}
