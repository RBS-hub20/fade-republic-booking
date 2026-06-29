"use client";

/**
 * Root-level error boundary (catches errors in the root layout itself).
 * Must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0f1116",
          color: "#e5e7eb",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 480, padding: 32, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Application error</h2>
          <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 8 }}>
            A server-side exception occurred. If this is a fresh setup, initialise the
            database with <code>npm run db:reset</code>.
          </p>
          {error.digest && (
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
              Digest: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#e0b54a",
              color: "#000",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
