// PROTOTYPE (throwaway) — Variant B "Gallery": a thumbnail grid, like a video app. Adding goes
// through a floating + button and a dialog (Link | Upload tabs). The queue lives in a side panel on
// desktop and a bottom tray on mobile.
import { Button } from "@notebook/ui/components/button";
import { Input } from "@notebook/ui/components/input";
import {
  AlertTriangle,
  FileAudio,
  Link2,
  ListTodo,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
  MonitorPlay,
} from "lucide-react";
import { useState } from "react";

import {
  type Source,
  failureCopy,
  fmtDuration,
  isUrl,
  matches,
  stageLabel,
  type useLibrary,
} from "./fixtures";

export const name = "Gallery + queue";

export function VariantB({ lib }: { lib: ReturnType<typeof useLibrary> }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const inFlight = lib.sources.filter((s) => s.stage !== "done");
  const shown = lib.sources.filter((s) => s.stage === "done" && matches(s, q));

  return (
    <div className="flex min-h-0 w-full">
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Library</h1>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="pl-8"
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center text-muted-foreground">
            <p>{lib.sources.length === 0 ? "Your Library is empty." : "No Sources match."}</p>
            {lib.sources.length === 0 && (
              <Button onClick={() => setAdding(true)}>
                <Plus /> Add your first Source
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <article key={s.id} className="group cursor-pointer">
                <Thumb s={s} />
                <h3 className="mt-2 line-clamp-2 leading-snug font-medium group-hover:underline">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {s.channel ?? (s.kind === "upload" ? "Uploaded file" : "Web")}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Desktop queue panel */}
      <aside className="hidden w-80 shrink-0 border-l p-4 lg:block">
        <Queue lib={lib} inFlight={inFlight} />
      </aside>

      {/* Mobile tray toggle */}
      {inFlight.length > 0 && (
        <button
          type="button"
          onClick={() => setTrayOpen(true)}
          className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm shadow-lg lg:hidden"
        >
          <ListTodo className="size-4" /> {inFlight.length} in queue
        </button>
      )}
      {trayOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[60vh] overflow-auto border-t bg-background p-4 shadow-2xl lg:hidden">
          <div className="mb-2 flex justify-end">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Close queue"
              onClick={() => setTrayOpen(false)}
            >
              <X />
            </Button>
          </div>
          <Queue lib={lib} inFlight={inFlight} />
        </div>
      )}

      <button
        type="button"
        aria-label="Add a Source"
        onClick={() => setAdding(true)}
        className="fixed right-6 bottom-20 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl lg:right-[22rem]"
      >
        <Plus className="size-6" />
      </button>

      {adding && <AddDialog lib={lib} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Queue({ lib, inFlight }: { lib: ReturnType<typeof useLibrary>; inFlight: Source[] }) {
  return (
    <>
      <h2 className="mb-3 text-sm font-semibold">Queue</h2>
      {inFlight.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing transcribing.</p>
      )}
      <ul className="space-y-3">
        {inFlight.map((s) => (
          <li key={s.id} className="border p-3">
            <div className="line-clamp-2 text-sm font-medium">{s.title}</div>
            {s.stage === "failed" && s.failure ? (
              <>
                <div className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {failureCopy[s.failure].title}. {failureCopy[s.failure].hint}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  {failureCopy[s.failure].retry && (
                    <Button size="xs" variant="outline" onClick={() => lib.retry(s.id)}>
                      <RotateCw /> Retry
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => lib.remove(s.id)}>
                    <Trash2 /> Remove
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 h-1.5 w-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${s.progress * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {stageLabel(s)}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Thumb({ s }: { s: Source }) {
  const Icon = s.kind === "youtube" ? MonitorPlay : s.kind === "upload" ? FileAudio : Link2;
  return (
    <div
      className="relative flex aspect-video items-center justify-center text-white/80"
      style={{
        background: `linear-gradient(135deg, oklch(0.5 0.13 ${s.hue}), oklch(0.3 0.08 ${s.hue + 40}))`,
      }}
    >
      <Icon className="size-10" />
      <span className="absolute right-1.5 bottom-1.5 bg-black/75 px-1.5 py-0.5 text-xs text-white tabular-nums">
        {fmtDuration(s.durationSec)}
      </span>
    </div>
  );
}

function AddDialog({ lib, onClose }: { lib: ReturnType<typeof useLibrary>; onClose: () => void }) {
  const [tab, setTab] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [dupe, setDupe] = useState<Source | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <dialog
        open
        aria-label="Add a Source"
        className="relative m-0 w-full max-w-md bg-background p-5 text-foreground shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add a Source</h2>
          <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="mb-4 grid grid-cols-2 border">
          {(["link", "upload"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 text-sm ${tab === t ? "bg-primary text-primary-foreground" : ""}`}
            >
              {t === "link" ? "Paste link" : "Upload file"}
            </button>
          ))}
        </div>
        {tab === "link" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isUrl(url)) return;
              const d = lib.findDuplicate(url);
              if (d && !dupe) return setDupe(d);
              lib.addUrl(url);
              onClose();
            }}
            className="space-y-3"
          >
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setDupe(null);
              }}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            {dupe && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                “{dupe.title}” is already in your Library. Press Transcribe again to add it anyway.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={!isUrl(url)}>
              {dupe ? "Transcribe again" : "Transcribe"}
            </Button>
          </form>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed p-10 text-center text-sm text-muted-foreground">
            <FileAudio className="size-8" />
            Choose audio or video files
            <input
              type="file"
              accept="audio/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                for (const f of e.target.files ?? []) lib.addFile(f.name);
                onClose();
              }}
            />
          </label>
        )}
      </dialog>
    </div>
  );
}
