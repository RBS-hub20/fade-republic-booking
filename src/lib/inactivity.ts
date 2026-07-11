"use client";

import { useEffect, useState } from "react";

/**
 * Tiny global pub/sub for pausing the inactivity auto-logout timer. Any
 * component that opens a sensitive modal, starts a transaction, or runs a file
 * upload calls `pushInactivityPause(reason)` and invokes the returned release
 * fn when done. While the pause count is > 0 the idle timer is frozen (the hard
 * cap still applies).
 */
const reasons = new Set<symbol>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Pause the idle timer. Returns a release fn (idempotent). */
export function pushInactivityPause(_reason = "modal"): () => void {
  const token = Symbol(_reason);
  reasons.add(token);
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    reasons.delete(token);
    emit();
  };
}

export function isInactivityPaused(): boolean {
  return reasons.size > 0;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive hook: true while any component is holding a pause. */
export function useInactivityPaused(): boolean {
  const [paused, setPaused] = useState(isInactivityPaused());
  useEffect(() => subscribe(() => setPaused(isInactivityPaused())), []);
  return paused;
}

/**
 * Convenience hook: hold a pause for as long as `active` is true (e.g. a modal's
 * `open` state, or an in-flight submission). Auto-releases on unmount.
 */
export function useHoldInactivityPause(active: boolean, reason = "modal"): void {
  useEffect(() => {
    if (!active) return;
    const release = pushInactivityPause(reason);
    return release;
  }, [active, reason]);
}
