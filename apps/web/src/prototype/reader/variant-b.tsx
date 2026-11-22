// PROTOTYPE (throwaway) — Variant B "Watch + transcript": media first. Big player on the left
// (top on phones) with chapters under it; the Transcript is a scrolling panel of timestamped
// paragraph rows on the right (below on phones), with its own search that lists hits and jumps.
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { type Sample, activeWordIndex, fmt, usePlayer, visibleWords } from "./model";

export const name = "Watch + transcript";

export function VariantB({ sample, hideFillers }: { sample: Sample; hideFillers: boolean }) {
  const { mountRef, time, playing, seek, toggle } = usePlayer(sample);
  const [q, setQ] = useState("");
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);
  const active = activeWordIndex(sample.words, time);
  const activePara = sample.paragraphs.findIndex((p) => time >= p.start && time < p.end);

  // Keep the active row in view inside the panel (not the page).
  useEffect(() => {
    const row = activeRowRef.current;
    const panel = panelRef.current;
    if (!row || !panel || !playing) return;
    const top = row.offsetTop - panel.offsetTop - panel.clientHeight / 3;
    panel.scrollTo({ top, behavior: "smooth" });
  }, [activePara, playing]);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return sample.paragraphs.flatMap((p, k) => {
      const text = p.words.map((w) => w.w).join(" ");
      const at = text.toLowerCase().indexOf(t);
      return at < 0
        ? []
        : [{ k, start: p.start, excerpt: text.slice(Math.max(0, at - 40), at + 80) }];
    });
  }, [q, sample]);

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-6">
      <section>
        <div className={sample.playback === "youtube" ? "aspect-video w-full bg-black" : ""}>
          <div ref={mountRef} className="size-full [&_audio]:w-full" />
        </div>
        {sample.playback === "audio" && (
          <div className="flex aspect-[3/1] items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900 text-white">
            <button
              type="button"
              onClick={toggle}
              className="rounded-full bg-white/15 px-6 py-3 text-lg"
            >
              {playing ? "Pause" : "Play"} · {fmt(time + sample.offset)}
            </button>
          </div>
        )}
        <h1 className="mt-4 text-xl font-semibold">{sample.title}</h1>
        <p className="text-sm text-muted-foreground">{sample.channel}</p>

        {sample.chapters.length > 0 && (
          <div className="mt-4 border">
            <button
              type="button"
              onClick={() => setChaptersOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
            >
              Chapters{" "}
              <ChevronDown className={`size-4 transition ${chaptersOpen ? "rotate-180" : ""}`} />
            </button>
            {chaptersOpen && (
              <ol>
                {sample.chapters.map((c, i) => {
                  const next = sample.chapters[i + 1]?.start ?? Infinity;
                  const on = time >= c.start && time < next;
                  return (
                    <li key={c.start}>
                      <button
                        type="button"
                        onClick={() => seek(c.start)}
                        className={`flex w-full gap-3 border-t px-3 py-2 text-left text-sm ${on ? "bg-primary/10 font-medium" : ""}`}
                      >
                        <span className="w-12 text-muted-foreground tabular-nums">
                          {fmt(c.start)}
                        </span>
                        {c.title}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col border lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search in transcript"
            className="h-8 flex-1 bg-transparent text-sm outline-none"
          />
          {q && <span className="text-xs text-muted-foreground">{hits.length} hits</span>}
        </div>

        {hits.length > 0 ? (
          <ol className="flex-1 overflow-auto">
            {hits.map((h) => (
              <li key={h.k}>
                <button
                  type="button"
                  onClick={() => {
                    seek(h.start);
                    setQ("");
                  }}
                  className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="mr-2 text-xs text-primary tabular-nums">
                    {fmt(h.start + sample.offset)}
                  </span>
                  …{h.excerpt}…
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div ref={panelRef} className="max-h-[60vh] flex-1 overflow-auto lg:max-h-none">
            {sample.paragraphs.map((p, k) => (
              <button
                type="button"
                key={p.start}
                ref={k === activePara ? activeRowRef : undefined}
                onClick={() => seek(p.start)}
                className={`flex w-full gap-3 border-b px-3 py-3 text-left text-sm leading-relaxed ${k === activePara ? "bg-primary/10" : "hover:bg-muted/60"}`}
              >
                <span className="w-12 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                  {fmt(p.start + sample.offset)}
                </span>
                <span>
                  {visibleWords(p.words, hideFillers).map(({ word, text }) => (
                    <span
                      key={word.i}
                      className={word.i === active ? "font-semibold text-primary" : ""}
                    >
                      {text}{" "}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
