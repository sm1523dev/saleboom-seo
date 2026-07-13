"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <p className="font-mono text-5xl font-bold text-destructive">500</p>
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Try reloading the page.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground/60">{error.digest}</p>
      )}
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
