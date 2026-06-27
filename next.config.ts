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
    // Add remote image hostnames here as integrations are added
    // e.g. { protocol: "https", hostname: "avatars.githubusercontent.com" }
    remotePatterns: [],
  },
};

export default nextConfig;
