// PROTOTYPE (throwaway) — Variant A "Inbox": one column. A single smart bar on top takes a
// pasted link, a dropped file, or search text. In-flight Transcriptions are pinned above the list.
import { Button } from "@notebook/ui/components/button";
import {
  AlertTriangle,
  FileAudio,
  Link2,
  Loader2,
  RotateCw,
  Search,
  Trash2,
  Upload,
  MonitorPlay,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  type Source,
  failureCopy,
  fmtAgo,
  fmtDuration,
  isUrl,
  matches,
  stageLabel,
  type useLibrary,
} from "./fixtures";

export const name = "Inbox list";

export function VariantA({ lib }: { lib: ReturnType<typeof useLibrary> }) {
  const [text, setText] = useState("");
  const [dupe, setDupe] = useState<Source | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const looksLikeUrl = isUrl(text);

  const submit = () => {
    if (!looksLikeUrl) return;
    const existing = lib.findDuplicate(text.trim());
    if (existing) return setDupe(existing);
    lib.addUrl(text.trim());
    setText("");
  };

  const inFlight = lib.sources.filter((s) => s.stage !== "done" && s.stage !== "failed");
  const rest = lib.sources.filter(
    (s) => (s.stage === "done" || s.stage === "failed") && (looksLikeUrl || matches(s, text)),
  );

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 py-6"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        for (const f of e.dataTransfer.files) lib.addFile(f.name);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-center gap-2 border bg-background px-3 py-2 shadow-sm ${dragging ? "border-primary ring-2 ring-primary/30" : ""}`}
      >
        {looksLikeUrl ? (
          <Link2 className="size-4 text-primary" />
        ) : (
          <Search className="size-4 text-muted-foreground" />
        )}
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDupe(null);
          }}
          placeholder="Paste a link to transcribe, or search your Library"
          className="h-9 flex-1 bg-transparent text-base outline-none"
          aria-label="Paste a link or search"
        />
        {looksLikeUrl ? (
          <Button type="submit" size="sm">
            Transcribe
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> Upload
          </Button>
        )}
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
      <p className="mt-1 text-xs text-muted-foreground">
        {dragging
          ? "Drop to transcribe"
          : "YouTube and most media sites work. Or drop an audio/video file anywhere."}
      </p>

      {dupe && (
        <div className="mt-3 flex items-center justify-between gap-3 border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <span>
            Already in your Library: <strong>{dupe.title}</strong>
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline">
              Open
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                lib.addUrl(text.trim());
                setText("");
                setDupe(null);
              }}
            >
              Transcribe again
            </Button>
          </span>
        </div>
      )}

      {inFlight.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            In progress
          </h2>
          <ul className="divide-y border">
            {inFlight.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="mt-1.5 h-1 w-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${s.stage === "queued" ? 0 : s.progress * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-36 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {stageLabel(s)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {text && !looksLikeUrl ? `${rest.length} matching` : "Library"}
        </h2>
        {rest.length === 0 ? (
          <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">
            {lib.sources.length === 0
              ? "Nothing here yet. Paste a YouTube link above, or drop a recording."
              : "No Sources match."}
          </div>
        ) : (
          <ul className="divide-y border">
            {rest.map((s) => (
              <li key={s.id} className="group flex items-start gap-3 p-3 hover:bg-muted/50">
                <KindIcon s={s} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {[s.channel, fmtDuration(s.durationSec), fmtAgo(s.addedAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {s.stage === "failed" && s.failure ? (
                    <div className="mt-1 flex items-center gap-2 text-xs text-destructive">
                      <AlertTriangle className="size-3.5" />
                      {failureCopy[s.failure].title}. {failureCopy[s.failure].hint}
                    </div>
                  ) : (
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{s.snippet}</p>
                  )}
                </div>
                {s.stage === "failed" && (
                  <div className="flex gap-1">
                    {s.failure && failureCopy[s.failure].retry && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Retry"
                        onClick={() => lib.retry(s.id)}
                      >
                        <RotateCw />
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove"
                      onClick={() => lib.remove(s.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KindIcon({ s }: { s: Source }) {
  const Icon = s.kind === "youtube" ? MonitorPlay : s.kind === "upload" ? FileAudio : Link2;
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center text-white"
      style={{ background: `oklch(0.55 0.12 ${s.hue})` }}
    >
      <Icon className="size-5" />
    </div>
  );
}
