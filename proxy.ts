import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Proxy is a first-line redirect guard only — it cannot be the sole auth check.
// Every Server Function and Route Handler must independently verify the session.
export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isProtected = pathname.startsWith("/dashboard");

  if (isProtected && !request.auth) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
