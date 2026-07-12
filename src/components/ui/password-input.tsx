"use client";

import { forwardRef, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputProps, "type"> & {
  /** Ms before a revealed password auto-hides. Default 30s; 0 disables. */
  autoHideMs?: number;
};

/**
 * Password field with a show/hide eye toggle inside the input.
 *
 * - Default hidden; the toggle flips type password<->text.
 * - A revealed password auto-hides after `autoHideMs` (30s default) as a
 *   shoulder-surfing safeguard. State is component-local, so it always resets
 *   to hidden on mount/refresh.
 * - Accessible: aria-label "Show/Hide password", aria-pressed, keyboard-
 *   focusable, and type="button" so it never submits the surrounding form.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, autoHideMs = 30_000, ...props }, ref) {
    const [show, setShow] = useState(false);

    useEffect(() => {
      if (!show || !autoHideMs) return;
      const t = setTimeout(() => setShow(false), autoHideMs);
      return () => clearTimeout(t);
    }, [show, autoHideMs]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-opacity hover:opacity-70 focus:outline-none focus-visible:opacity-70"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  }
);
