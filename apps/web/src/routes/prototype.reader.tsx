// PROTOTYPE (throwaway): three Reader variants on a throwaway route, switched with ?variant=A|B|C.
// ?source=lecture (YouTube embed) | podcast (our own audio file). See .scratch/notebook-v1/issues/04-*.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { samples } from "@/prototype/reader/model";
import { VariantA, name as nameA } from "@/prototype/reader/variant-a";
import { VariantB, name as nameB } from "@/prototype/reader/variant-b";
import { VariantC, name as nameC } from "@/prototype/reader/variant-c";

export const Route = createFileRoute("/prototype/reader")({
  validateSearch: (s: Record<string, unknown>): { variant?: string; scenario?: string } => ({
    variant: typeof s.variant === "string" ? s.variant : undefined,
    scenario: typeof s.scenario === "string" ? s.scenario : undefined,
  }),
  component: Reader,
});

const variants = [
  { key: "A", name: nameA },
  { key: "B", name: nameB },
  { key: "C", name: nameC },
];

function Reader() {
  // The switcher's "scenario" dropdown picks the sample here: lecture or podcast.
  const { variant = "A", scenario = "lecture" } = Route.useSearch();
  const sample = samples[scenario === "podcast" ? "podcast" : "lecture"];
  const [hideFillers, setHideFillers] = useState(true);

  return (
    <>
      <div key={`${variant}-${sample.key}`}>
        {variant === "A" && <VariantA sample={sample} hideFillers={hideFillers} />}
        {variant === "B" && <VariantB sample={sample} hideFillers={hideFillers} />}
        {variant === "C" && <VariantC sample={sample} hideFillers={hideFillers} />}
      </div>
      <label className="fixed bottom-16 left-4 z-[100] flex items-center gap-2 rounded-full bg-fuchsia-600 px-3 py-1 text-xs text-white shadow-xl">
        <input
          type="checkbox"
          checked={hideFillers}
          onChange={(e) => setHideFillers(e.target.checked)}
        />
        Hide “uh/um”
      </label>
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        scenarios={["lecture", "podcast"]}
        scenario={sample.key}
      />
    </>
  );
}
