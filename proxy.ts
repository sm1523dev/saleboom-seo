import { authProvider } from "@/lib/auth";

// Proxy is a first-line redirect guard only — it cannot be the sole auth check.
// Every Server Function and Route Handler must independently verify the session.
export const proxy = authProvider.getMiddleware();

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
