"use client";

import { useCallback, useState } from "react";

/**
 * Share a summary of a card. Uses the Web Share sheet where the browser has one
 * (every Filipino on mobile), and falls back to the clipboard on desktop.
 */
export function useShare(payload: { title: string; text: string }) {
  const [state, setState] = useState<"idle" | "shared" | "copied" | "failed">("idle");

  const share = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: payload.title, text: payload.text, url });
        setState("shared");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${payload.title}\n${payload.text}\n${url}`);
        setState("copied");
      } else {
        setState("failed");
      }
    } catch (err) {
      // A user-cancelled share sheet is not an error worth surfacing.
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setState(aborted ? "idle" : "failed");
      return;
    }
    setTimeout(() => setState("idle"), 2200);
  }, [payload.title, payload.text]);

  const label =
    state === "shared" ? "Shared" : state === "copied" ? "Copied" : state === "failed" ? "Try again" : "Share";

  return { share, label, state };
}
