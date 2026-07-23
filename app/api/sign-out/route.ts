import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// POST /api/sign-out
// Plain HTTP route handler — avoids server-action NEXT_REDIRECT mechanics.
// JWT session: deleting the session cookie is sufficient to sign out.
export async function POST(request: Request) {
  const cookieJar = await cookies();

  const origin = process.env.AUTH_URL ?? new URL(request.url).origin;

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
