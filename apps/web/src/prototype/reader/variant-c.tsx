// PROTOTYPE (throwaway) — Variant C "Focus": for following along. The current paragraph sits big
// and centred; finished text fades above, upcoming text is dim below. Word-by-word highlight, a
// large scrubber with paragraph ticks at the bottom, and a "Read" toggle that drops the focus effect
// and shows the full text at normal size for skimming.
import { BookOpen, Pause, Play, RotateCcw, RotateCw, Search, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type Sample, activeWordIndex, fmt, usePlayer, visibleWords } from "./model";

export const name = "Focus";

export function VariantC({ sample, hideFillers }: { sample: Sample; hideFillers: boolean }) {
  const { mountRef, time, playing, seek, toggle } = usePlayer(sample);
  const [mode, setMode] = useState<"focus" | "read">("focus");
  const [find, setFind] = useState("");
  const active = activeWordIndex(sample.words, time);
  const activePara = Math.max(
    0,
    sample.paragraphs.findIndex((p) => time >= p.start && time < p.end),
  );
  const paraRef = useRef<HTMLDivElement>(null);
  const total = sample.paragraphs.at(-1)?.end ?? 1;

  useEffect(() => {
    if (mode === "focus") paraRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activePara, mode]);

  const q = find.trim().toLowerCase();

  return (
    <div className="relative">
      {/* Media stays mounted but out of the way: a small floating thumbnail. */}
      <div
        className={`fixed top-14 right-4 z-30 overflow-hidden shadow-xl ${sample.playback === "youtube" ? "aspect-video w-56" : "w-0"}`}
      >
        <div ref={mountRef} className="size-full" />
      </div>

      <div className="mx-auto max-w-2xl px-6 pt-10 pb-56">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              {sample.channel}
            </p>
            <h1 className="text-lg font-semibold">{sample.title}</h1>
          </div>
        </div>

        <div className="mt-10 space-y-8">
          {sample.paragraphs.map((p, k) => {
            const state = k < activePara ? "past" : k === activePara ? "now" : "next";
            const focus = mode === "focus";
            return (
              <div
                key={p.start}
                ref={k === activePara ? paraRef : undefined}
                onClick={() => seek(p.start)}
                className={`cursor-pointer transition-all duration-500 ${
                  focus
                    ? state === "now"
                      ? "text-[1.6rem] leading-[1.6] text-foreground"
                      : state === "past"
                        ? "text-lg leading-relaxed text-foreground/25"
                        : "text-lg leading-relaxed text-foreground/40"
                    : "text-[1.1rem] leading-[1.75] text-foreground/90"
                }`}
              >
                {!focus && (
                  <span className="mr-2 align-top text-xs text-muted-foreground tabular-nums">
                    {fmt(p.start + sample.offset)}
                  </span>
                )}
                {visibleWords(p.words, hideFillers).map(({ word, text }) => {
                  const hit = q && text.toLowerCase().includes(q);
                  return (
                    <span
                      key={word.i}
                      onClick={(e) => {
                        e.stopPropagation();
                        seek(word.start);
                      }}
                      className={`${word.i === active ? "text-primary" : ""} ${state === "now" && word.i < active && focus ? "text-foreground" : ""} ${hit ? "bg-yellow-300/60" : ""}`}
                    >
                      {text}{" "}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom control dock */}
      <div className="fixed inset-x-0 bottom-14 z-30 px-4">
        <div className="mx-auto max-w-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur">
          <div className="relative h-2 cursor-pointer bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-primary"
              style={{ width: `${(time / total) * 100}%` }}
            />
            {sample.paragraphs.map((p) => (
              <button
                type="button"
                key={p.start}
                aria-label={`Jump to ${fmt(p.start)}`}
                onClick={() => seek(p.start)}
                className="absolute top-0 h-2 w-0.5 bg-foreground/30"
                style={{ left: `${(p.start / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-14 text-xs text-muted-foreground tabular-nums">
              {fmt(time + sample.offset)}
            </span>
            <button
              type="button"
              aria-label="Back 10 seconds"
              onClick={() => seek(Math.max(0, time - 10))}
              className="p-2"
            >
              <RotateCcw className="size-5" />
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={toggle}
              className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <button
              type="button"
              aria-label="Forward 10 seconds"
              onClick={() => seek(time + 10)}
              className="p-2"
            >
              <RotateCw className="size-5" />
            </button>
            <label className="ml-auto flex items-center gap-1 border px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Find"
                className="h-8 w-20 bg-transparent text-sm outline-none sm:w-32"
              />
            </label>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "focus" ? "read" : "focus"))}
              className="flex items-center gap-1 border px-2 py-1.5 text-xs"
            >
              {mode === "focus" ? <BookOpen className="size-4" /> : <Target className="size-4" />}
              {mode === "focus" ? "Read" : "Focus"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
