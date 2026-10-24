import { useEffect, useRef } from "react";
import { useCarmenSkins } from "@/hooks/useCarmenSkins";
import { BRAIN } from "@/lib/carmenBrainAccess";
import type { BrainChannel } from "./useBrainChannel";

/** Opens the sidecar on Carmen's internal brain and, for a session, her base skin. */
export function useSidecarSessionDefaults(
  brain: BrainChannel,
  session: boolean,
  keepSkin = false,
) {
  // The session opens on Carmen's internal brain once, but only after the
  // user's real brain list loads: a user without the internal brain keeps the
  // first brain they may use. After that the brain selector owns the choice.
  const initialBrainApplied = useRef(false);
  useEffect(() => {
    if (initialBrainApplied.current || !brain.routesReady) return;
    initialBrainApplied.current = true;
    const internal = brain.routes.find((r) => r.slug === BRAIN.internal);
    if (internal && brain.selected.slug !== BRAIN.internal)
      brain.selectRoute(internal, null);
  }, [brain.routesReady, brain.routes, brain.selected.slug, brain]);

  // Each session opens on Carmen's base skin; a skin is picked per task.
  const carmenSkins = useCarmenSkins();
  const initialSkinApplied = useRef(false);
  useEffect(() => {
    if (!session || keepSkin || initialSkinApplied.current) return;
    initialSkinApplied.current = true;
    if (carmenSkins.activeSlug) carmenSkins.setActiveSkin(null).catch(() => {});
  }, [session, keepSkin, carmenSkins]);
}
