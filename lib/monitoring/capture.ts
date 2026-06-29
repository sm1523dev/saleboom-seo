/**
 * Captures an error to Sentry if SENTRY_DSN is configured.
 * Safe to call unconditionally — no-ops when Sentry is not set up.
 */
export function captureError(err: unknown, ctx?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = require("@sentry/nextjs") as typeof import("@sentry/nextjs");
  Sentry.withScope((scope) => {
    if (ctx) scope.setExtras(ctx);
    Sentry.captureException(err);
  });
}
