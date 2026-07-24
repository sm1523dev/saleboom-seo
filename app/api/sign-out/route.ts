import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// POST /api/sign-out
// Plain HTTP route handler — avoids server-action NEXT_REDIRECT mechanics.
// JWT session: deleting the session cookie is sufficient to sign out.
export async function POST(request: Request) {
  const cookieJar = await cookies();

  // AUTH_URL (Azure) → NEXT_PUBLIC_APP_URL (Pi) → forwarded headers → request origin (local dev)
  const origin =
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ((): string => {
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      const host =
        request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      if (host) return `${proto}://${host}`;
      return new URL(request.url).origin;
    })();

  // Delete session tokens for both HTTPS (__Secure- prefix) and HTTP variants.
  // The Secure attribute must be present when deleting a __Secure- cookie.
  for (const [name, secure] of [
    ["__Secure-authjs.session-token", true],
    ["authjs.session-token", false],
    ["__Secure-authjs.callback-url", true],
    ["authjs.callback-url", false],
    ["__Host-authjs.csrf-token", true],
    ["authjs.csrf-token", false],
  ] as [string, boolean][]) {
    cookieJar.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return NextResponse.redirect(new URL("/", origin), { status: 303 });
}
