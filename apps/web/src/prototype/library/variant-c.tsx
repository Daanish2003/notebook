// PROTOTYPE (throwaway) — Variant C "Journal": text-first. A big search sits at the top and
// results show what was said (Transcript snippets) rather than thumbnails, grouped by when they were
// added. Adding is a composer pinned to the bottom of the screen, thumb-reachable on a phone, and
// in-flight Transcriptions appear inline as entries in the timeline.
import { Button } from "@notebook/ui/components/button";
import { AlertTriangle, ArrowUp, Loader2, Paperclip, RotateCw, Search, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  type Source,
  failureCopy,
  fmtDuration,
  isUrl,
  matches,
  stageLabel,
  type useLibrary,
} from "./fixtures";

export const name = "Journal";

const DAY = 86_400_000;

function bucket(ts: number) {
  const age = Date.now() - ts;
  if (age < DAY) return "Today";
  if (age < 2 * DAY) return "Yesterday";
  if (age < 7 * DAY) return "This week";
  return "Earlier";
}

export function VariantC({ lib }: { lib: ReturnType<typeof useLibrary> }) {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [dupe, setDupe] = useState<Source | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = lib.sources.filter((s) => matches(s, q));
  const groups = ["Today", "Yesterday", "This week", "Earlier"]
    .map((g) => ({ g, items: shown.filter((s) => bucket(s.addedAt) === g) }))
    .filter((x) => x.items.length);

  const send = () => {
    if (!isUrl(draft)) return;
    const d = lib.findDuplicate(draft);
    if (d && !dupe) return setDupe(d);
    lib.addUrl(draft.trim());
    setDraft("");
    setDupe(null);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-8 pb-40">
      <label className="flex items-center gap-3 border-b-2 pb-2 focus-within:border-primary">
        <Search className="size-5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What was that talk about consensus…"
          className="flex-1 bg-transparent text-xl outline-none placeholder:text-muted-foreground/60"
          aria-label="Search everything you've transcribed"
        />
      </label>

      {groups.length === 0 && (
        <p className="mt-16 text-center text-muted-foreground">
          {lib.sources.length === 0
            ? "Paste a link below to transcribe your first Source."
            : `Nothing said “${q}”.`}
        </p>
      )}

      {groups.map(({ g, items }) => (
        <section key={g} className="mt-8">
          <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {g}
          </h2>
          <ol className="space-y-6 border-l pl-5">
            {items.map((s) => (
              <li key={s.id} className="relative">
                <span
                  className={`absolute top-2 -left-[25px] size-2 rounded-full ${s.stage === "done" ? "bg-foreground" : s.stage === "failed" ? "bg-destructive" : "bg-primary"}`}
                />
                <h3 className="font-serif text-lg leading-snug">{s.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {[
                    s.channel ?? (s.kind === "upload" ? "Upload" : null),
                    fmtDuration(s.durationSec),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {s.stage === "done" && (
                  <p className="mt-2 line-clamp-3 font-serif text-[15px] leading-relaxed text-foreground/80">
                    <Highlight text={s.snippet ?? ""} q={q} />
                  </p>
                )}
                {(s.stage === "queued" ||
                  s.stage === "downloading" ||
                  s.stage === "transcribing") && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="size-4 animate-spin" /> {stageLabel(s)}
                  </p>
                )}
                {s.stage === "failed" && s.failure && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="size-4" /> {failureCopy[s.failure].title}.
                    </span>
                    <span className="text-muted-foreground">{failureCopy[s.failure].hint}</span>
                    {failureCopy[s.failure].retry && (
                      <Button size="xs" variant="outline" onClick={() => lib.retry(s.id)}>
                        <RotateCw /> Retry
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" onClick={() => lib.remove(s.id)}>
                      <Trash2 /> Remove
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-14 z-40 px-4">
        <div className="mx-auto max-w-xl">
          {dupe && (
            <p className="mb-2 bg-background/95 p-2 text-sm shadow">
              “{dupe.title}” is already here. Send again to transcribe it anyway.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 rounded-2xl border bg-background p-2 shadow-xl"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Attach audio or video"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip />
            </Button>
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDupe(null);
              }}
              placeholder="Paste a link to transcribe"
              className="h-9 flex-1 bg-transparent outline-none"
              aria-label="Paste a link to transcribe"
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full"
              disabled={!isUrl(draft)}
              aria-label="Transcribe"
            >
              <ArrowUp />
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                for (const f of e.target.files ?? []) lib.addFile(f.name);
              }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const t = q.trim();
  if (!t) return <>{text}</>;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      …{text.slice(Math.max(0, i - 60), i)}
      <mark className="bg-yellow-300/60 text-inherit">{text.slice(i, i + t.length)}</mark>
      {text.slice(i + t.length)}
    </>
  );
}
