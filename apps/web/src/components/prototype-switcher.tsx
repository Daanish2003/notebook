// PROTOTYPE (throwaway): floating variant switcher. Never shown in production builds.
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

type Props = {
  variants: { key: string; name: string }[];
  current: string;
  scenarios?: string[];
  scenario?: string;
};

export function PrototypeSwitcher({ variants, current, scenarios, scenario }: Props) {
  const navigate = useNavigate();
  const at = (i: number) => variants[(i + variants.length) % variants.length]?.key ?? "A";
  const idx = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  const go = (key: string, sc = scenario) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, variant: key, scenario: sc }),
      replace: true,
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, [contenteditable]") || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(at(idx - 1));
      if (e.key === "ArrowRight") go(at(idx + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;
  const v = variants[idx] ?? { key: current, name: "" };

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 px-2 py-1 text-sm text-white shadow-2xl ring-2 ring-white/40">
      <button
        type="button"
        aria-label="Previous variant"
        className="rounded-full p-1 hover:bg-white/20"
        onClick={() => go(at(idx - 1))}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-40 text-center font-medium">
        {v.key} ({v.name})
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="rounded-full p-1 hover:bg-white/20"
        onClick={() => go(at(idx + 1))}
      >
        <ChevronRight className="size-4" />
      </button>
      {scenarios && (
        <select
          aria-label="Scenario"
          className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs"
          value={scenario}
          onChange={(e) => go(v.key, e.target.value)}
        >
          {scenarios.map((s) => (
            <option key={s} value={s} className="text-black">
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
