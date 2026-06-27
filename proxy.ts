import { NextResponse } from "next/server";
import type { NextProxy } from "next/server";

// Routes that require an authenticated session.
// IMPORTANT: Proxy is a first-line redirect guard only — it cannot be the sole
// auth check. Every Server Action and Route Handler must independently verify
// the session. See: https://nextjs.org/docs/app/guides/data-security
const PROTECTED_PREFIXES = ["/dashboard"];
const SIGN_IN_PATH = "/sign-in";

// Checks for an active Auth.js (NextAuth v5) session cookie.
// Replace this entire function body with `export { auth as proxy } from "@/lib/auth"`
// once Auth.js is configured in SALEB-26.
function hasSession(request: Parameters<NextProxy>[0]): boolean {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token")
  );
}

export const proxy: NextProxy = (request) => {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !hasSession(request)) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);
    // Preserve full path + query so the user lands back where they intended.
    signInUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
};

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Static image/font file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
