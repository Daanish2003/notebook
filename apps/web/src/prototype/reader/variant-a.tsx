// PROTOTYPE (throwaway) — Variant A "Article": the Transcript reads like a long-form article.
// Centred serif column, paragraph timestamps in the left margin, a slim sticky player bar (video
// collapses to a small thumbnail you can expand), word-level highlight, click any word to seek.
import { ArrowLeft, Pause, Play, Search, Video, VideoOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { type Sample, activeWordIndex, fmt, usePlayer, visibleWords } from "./model";

export const name = "Article";

export function VariantA({ sample, hideFillers }: { sample: Sample; hideFillers: boolean }) {
  const { mountRef, time, playing, seek, toggle } = usePlayer(sample);
  const [showVideo, setShowVideo] = useState(false);
  const [follow, setFollow] = useState(true);
  const [find, setFind] = useState("");
  const active = activeWordIndex(sample.words, time);
  const activeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (follow && playing)
      activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active, follow, playing]);

  const chapterAt = useMemo(
    () => new Map(sample.chapters.map((c) => [c.start, c.title])),
    [sample],
  );
  const q = find.trim().toLowerCase();

  return (
    <div className="pb-32">
      {/* Sticky player bar */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <button type="button" aria-label="Back to Library" className="p-1 text-muted-foreground">
            <ArrowLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={toggle}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{sample.title}</div>
            <div className="text-xs text-muted-foreground tabular-nums">{fmt(time)}</div>
          </div>
          <label className="hidden items-center gap-1 border px-2 sm:flex">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Find"
              className="h-7 w-28 bg-transparent text-sm outline-none"
            />
          </label>
          <button
            type="button"
            aria-label={showVideo ? "Hide video" : "Show video"}
            onClick={() => setShowVideo((v) => !v)}
            className="p-1 text-muted-foreground"
          >
            {showVideo ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </button>
        </div>
        <div
          ref={mountRef}
          className={`mx-auto max-w-3xl px-4 ${showVideo && sample.playback === "youtube" ? "aspect-video pb-2" : "h-0 overflow-hidden"}`}
        />
      </div>

      <article className="mx-auto max-w-[68ch] px-5 pt-10">
        <p className="text-sm text-muted-foreground">{sample.channel}</p>
        <h1 className="mt-1 font-serif text-3xl leading-tight font-semibold">{sample.title}</h1>
        <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Follow along while playing
        </label>

        <div className="mt-8 space-y-6 font-serif text-[1.15rem] leading-[1.75]">
          {sample.paragraphs.map((para) => {
            const chapter =
              sample.chapters.find((c) => c.start >= para.start && c.start < para.end) ?? null;
            return (
              <div key={para.start}>
                {chapter && chapterAt.has(chapter.start) && (
                  <h2 className="mt-10 mb-4 font-sans text-lg font-semibold">{chapter.title}</h2>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => seek(para.start)}
                    className="absolute top-1.5 -left-16 hidden w-12 text-right font-sans text-xs text-muted-foreground tabular-nums hover:text-primary md:block"
                  >
                    {fmt(para.start + sample.offset)}
                  </button>
                  <p>
                    {visibleWords(para.words, hideFillers).map(({ word, text }) => {
                      const isActive = word.i === active;
                      const hit = q && text.toLowerCase().includes(q);
                      return (
                        <span key={word.i}>
                          <span
                            ref={isActive ? activeRef : undefined}
                            onClick={() => seek(word.start)}
                            className={`cursor-pointer rounded-sm ${isActive ? "bg-primary/25" : word.i < active ? "text-foreground" : "text-foreground/85"} ${hit ? "bg-yellow-300/60" : ""} ${word.p < 0.5 ? "underline decoration-dotted decoration-muted-foreground/60" : ""}`}
                          >
                            {text}
                          </span>{" "}
                        </span>
                      );
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
