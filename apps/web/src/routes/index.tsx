// PROTOTYPE (throwaway): three Library variants on the home route, switched with
// ?variant=A|B|C and ?scenario=normal|empty|offline. See .scratch/notebook-v1/issues/05-*.
import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { useLibrary } from "@/prototype/library/fixtures";
import { Unreachable } from "@/prototype/library/unreachable";
import { VariantA, name as nameA } from "@/prototype/library/variant-a";
import { VariantB, name as nameB } from "@/prototype/library/variant-b";
import { VariantC, name as nameC } from "@/prototype/library/variant-c";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { variant?: string; scenario?: string } => ({
    variant: typeof s.variant === "string" ? s.variant : undefined,
    scenario: typeof s.scenario === "string" ? s.scenario : undefined,
  }),
  component: HomeComponent,
});

const variants = [
  { key: "A", name: nameA },
  { key: "B", name: nameB },
  { key: "C", name: nameC },
];

function HomeComponent() {
  const { variant = "A", scenario = "normal" } = Route.useSearch();
  // Remount the in-memory Library whenever the scenario changes.
  return <Library key={scenario} variant={variant} scenario={scenario} />;
}

function Library({ variant, scenario }: { variant: string; scenario: string }) {
  const lib = useLibrary(scenario === "empty");
  return (
    <>
      {scenario === "offline" ? (
        <Unreachable />
      ) : (
        <>
          {variant === "A" && <VariantA lib={lib} />}
          {variant === "B" && <VariantB lib={lib} />}
          {variant === "C" && <VariantC lib={lib} />}
        </>
      )}
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        scenarios={["normal", "empty", "offline"]}
        scenario={scenario}
      />
    </>
  );
}
