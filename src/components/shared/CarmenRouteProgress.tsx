import { useEffect, useState, useSyncExternalStore } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  getCarmenLoaderSnapshot,
  subscribeCarmenLoader,
} from "@/lib/carmenLoaderSignal";

const SERVER_SNAPSHOT = { waiting: 0, scenes: 0 };

/**
 * Thin bar under the header for everything too short to deserve the full Carmen
 * scene: quick navigations and background refetches. It steps aside as soon as a
 * scene takes over, so the two never compete.
 */
export function CarmenRouteProgress() {
  const { waiting, scenes } = useSyncExternalStore(
    subscribeCarmenLoader,
    getCarmenLoaderSnapshot,
    () => SERVER_SNAPSHOT,
  );
  // Only first loads: a poll or a background refetch of cached data must not
  // blink the bar every few seconds on Chat, TimeTracking or SalesDashboard.
  const loadingFirstTime = useIsFetching({
    predicate: (query) => query.state.data === undefined,
  });
  const busy = scenes === 0 && (waiting > 0 || loadingFirstTime > 0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), 150);
    return () => window.clearTimeout(timer);
  }, [busy]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none sticky top-0 z-40 h-[3px] w-full shrink-0 overflow-hidden bg-primary/10 transition-opacity duration-300",
        shown ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full w-2/5 animate-carmen-track rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.55)] motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}
