/**
 * Shared signal between the Carmen loading screens and the thin route progress
 * bar, so a navigation shows one continuous indicator instead of several:
 * short waits get the bar only, long waits escalate to the full scene, and a
 * route chunk handing off to its data query does not restart the sequence.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
const fadeOutCancelers = new Set<() => void>();

let waiting = 0;
let scenes = 0;
let lastSceneEndedAt = 0;
let snapshot = { waiting, scenes };

function emit() {
  snapshot = { waiting, scenes };
  for (const listener of listeners) listener();
}

export function subscribeCarmenLoader(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCarmenLoaderSnapshot() {
  return snapshot;
}

/** A loader is mounted but still silent (too early to show anything). */
export function registerCarmenWait() {
  waiting += 1;
  // A follow-up wait means the previous scene is handing off — drop its ghost.
  cancelCarmenFadeOutGhosts();
  emit();
  return () => {
    waiting -= 1;
    emit();
  };
}

/** The full Carmen scene is on screen — the thin bar steps aside. */
export function registerCarmenScene() {
  scenes += 1;
  // Scene→scene hand-off: remove the previous scene's dissolve clone so the eye
  // does not jump (ghost + live scene stacked for ~260ms).
  cancelCarmenFadeOutGhosts();
  emit();
  return () => {
    scenes -= 1;
    lastSceneEndedAt = Date.now();
    emit();
  };
}

/**
 * True right after another scene disappeared, e.g. the route chunk finished and
 * the page's own query took over. The next scene then appears without replaying
 * its delay and fade.
 */
export function carmenSceneJustEnded(withinMs = 900) {
  return scenes > 0 || Date.now() - lastSceneEndedAt < withinMs;
}

/**
 * Register a dissolve-clone remover. When the next wait/scene registers, every
 * pending ghost is cancelled so scene→scene hand-offs stay on one eye.
 * Scene→content keeps the ghost (nothing cancels it) and it fades out normally.
 */
export function registerCarmenFadeOutCanceler(cancel: () => void) {
  fadeOutCancelers.add(cancel);
  return () => {
    fadeOutCancelers.delete(cancel);
  };
}

export function cancelCarmenFadeOutGhosts() {
  if (fadeOutCancelers.size === 0) return 0;
  const count = fadeOutCancelers.size;
  for (const cancel of [...fadeOutCancelers]) {
    try {
      cancel();
    } catch {
      /* ignore */
    }
  }
  fadeOutCancelers.clear();
  return count;
}

/**
 * Legacy eager decision used by the pre-fix fade-out path: spawn whenever the
 * snapshot looks idle. During a Suspense→page hand-off that is true for one
 * turn — which is the flicker (ghost + continued scene).
 */
export function wouldLegacyEagerSpawnGhost(
  state: { waiting: number; scenes: number } = getCarmenLoaderSnapshot(),
): boolean {
  return state.scenes === 0 && state.waiting === 0;
}

/**
 * Route content should only ease in when nothing Carmen-related is covering it.
 * Fading the scroll container while a scene/wait is active animates the eye
 * itself (opacity 0→1) and looks like a flicker.
 */
export function shouldFadeRouteContent(
  state: { waiting: number; scenes: number } = getCarmenLoaderSnapshot(),
): boolean {
  return state.scenes === 0 && state.waiting === 0;
}

/** Test-only: restore module counters between cases. */
export function __resetCarmenLoaderSignalForTests() {
  waiting = 0;
  scenes = 0;
  lastSceneEndedAt = 0;
  snapshot = { waiting, scenes };
  listeners.clear();
  fadeOutCancelers.clear();
}
