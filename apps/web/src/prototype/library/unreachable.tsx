// PROTOTYPE (throwaway): what every variant shows when the Omarchy machine can't be reached.
// Devices hold no Library data, so there is nothing to show but the reason and a way to retry.
import { Button } from "@notebook/ui/components/button";
import { WifiOff } from "lucide-react";

export function Unreachable() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-24 text-center">
      <WifiOff className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Can't reach omarchy</h1>
      <p className="text-sm text-muted-foreground">
        Notebook lives on your desktop. Check that Tailscale is connected on this device, and that
        you're logged in on omarchy. Opening Notebook starts it automatically.
      </p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
      <p className="text-xs text-muted-foreground">Last connected 2 h ago</p>
    </div>
  );
}
