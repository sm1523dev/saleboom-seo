import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
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
    "@aws-sdk/client-sqs",
    "@azure/storage-blob",
    "@azure/storage-queue",
    "@ai-sdk/anthropic",
    "@ai-sdk/ollama",
    "@ai-sdk/openai",
    "@ai-sdk/azure",
  ],
};

export default nextConfig;
