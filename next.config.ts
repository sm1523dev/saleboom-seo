import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",

  headers: async () => [
    {
      source: "/:path*",
      headers: SECURITY_HEADERS,
    },
  ],

  images: {
    remotePatterns: [],
  },

  // Optional provider packages — only needed when the matching *_PROVIDER env var
  // selects them. Exclude from the Next.js bundle so unused providers don't cause
  // "module not found" errors at build time.
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/auto-instrumentations-node",
    "@aws-sdk/client-sqs",
    "@aws-sdk/client-sesv2",
    "@azure/storage-blob",
    "@azure/storage-queue",
    "@ai-sdk/anthropic",
    "@ai-sdk/ollama",
    "@ai-sdk/openai",
    "@ai-sdk/azure",
    "@sendgrid/mail",
    "twilio",
  ],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Only upload source maps when SENTRY_DSN is set (i.e. in production builds)
  sourcemaps: { disable: !process.env.SENTRY_DSN },
  telemetry: false,
});
