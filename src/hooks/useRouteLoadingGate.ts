import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";

/**
 * React Query starts a query in an effect, i.e. after the first paint of the
 * new route — so the gate waits a couple of frames before deciding whether
 * anything is loading at all.
 */
const ARM_MS = 50;

/** Release once first loads have been quiet for this long. */
const SETTLE_MS = 120;

/** Content is never hidden longer than this, whatever the page is doing. */
const MAX_HOLD_MS = 4000;

/**
 * True while a navigation is still resolving its first data.
 *
 * Pages gate their queries on `enabled: !!tenantId`, and React Query reports
 * `isLoading === false` for a query that is still disabled — so a page paints
 * "אין דוחות" before its fetch even starts. Rather than patch every empty
 * state, the route keeps its content hidden (mounted, so the queries do run)
 * until those first loads settle, and shows Carmen instead.
 */
export function useRouteLoadingGate(): boolean {
  const { pathname } = useLocation();
  const firstLoads = useIsFetching({
    predicate: (query) => query.state.data === undefined,
  });
  const [holding, setHolding] = useState(true);
  const [armed, setArmed] = useState(true);
  const sawFirstLoad = useRef(false);

  useEffect(() => {
    setHolding(true);
    setArmed(true);
    sawFirstLoad.current = false;
    const timer = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (firstLoads > 0) sawFirstLoad.current = true;
  }, [firstLoads]);

  useEffect(() => {
    if (!holding) return;
    const cap = window.setTimeout(() => setHolding(false), MAX_HOLD_MS);
    return () => window.clearTimeout(cap);
  }, [holding, pathname]);

  useEffect(() => {
    if (!holding || armed || firstLoads > 0) return;
    // A page served from cache never fetched anything — reveal it right away
    // instead of charging every navigation for the settle window.
    if (!sawFirstLoad.current) {
      setHolding(false);
      return;
    }
    const timer = window.setTimeout(() => setHolding(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [holding, armed, firstLoads]);

  return holding;
}
