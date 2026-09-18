import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import {
  getCarmenLoaderSnapshot,
  shouldFadeRouteContent,
  subscribeCarmenLoader,
} from "@/lib/carmenLoaderSignal";

const SERVER_SNAPSHOT = { waiting: 0, scenes: 0 };

/**
 * Eases the route content in after a navigation and after a Carmen scene hands
 * over, so data arrives instead of popping. Animates the existing container by
 * ref — no wrapper element, so no page layout is affected.
 */
export function useCarmenContentFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { pathname } = useLocation();
  const snapshot = useSyncExternalStore(
    subscribeCarmenLoader,
    getCarmenLoaderSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const previousScenes = useRef(snapshot.scenes);

  const fade = useCallback(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Never fade the scroll container while Carmen (or her wait) is inside it —
    // that animates the eye from opacity 0 and reads as a flicker/jump.
    if (!shouldFadeRouteContent(getCarmenLoaderSnapshot())) return;
    element.animate(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 280, easing: "ease-out" },
    );
  }, []);

  useEffect(fade, [pathname, fade]);

  useEffect(() => {
    if (previousScenes.current > 0 && snapshot.scenes === 0) fade();
    previousScenes.current = snapshot.scenes;
  }, [snapshot.scenes, fade]);

  return ref;
}
