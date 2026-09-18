/**
 * Shared signal between the Carmen loading screens and the thin route progress
 * bar, so a navigation shows one continuous indicator instead of several:
 * short waits get the bar only, long waits escalate to the full scene, and a
 * route chunk handing off to its data query does not restart the sequence.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

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
  emit();
  return () => {
    waiting -= 1;
    emit();
  };
}

/** The full Carmen scene is on screen — the thin bar steps aside. */
export function registerCarmenScene() {
  scenes += 1;
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
