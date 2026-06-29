"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Friendly error boundary for the authenticated app pages. The most common
 * cause of a server error here is an uninitialised database (tables missing).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const looksLikeDb =
    /does not exist|no such table|database|PrismaClient|connect/i.test(error.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-loss/15 text-loss">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold">Something went wrong</h2>

        {looksLikeDb ? (
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p>
              The database doesn&apos;t seem to be set up yet. Initialise it with the
              seed data and try again:
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-foreground">
              npm run db:reset
            </pre>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            An unexpected error occurred while loading this page.
          </p>
        )}

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Digest: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-gold-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold-300"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
