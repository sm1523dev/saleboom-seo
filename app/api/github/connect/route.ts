import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-utils";

function signState(websiteId: string): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) throw new Error("PASSWORD_PEPPER not set");
  const hmac = createHmac("sha256", pepper).update(websiteId).digest("hex").slice(0, 16);
  return `${websiteId}:${hmac}`;
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await getServerSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const websiteId = searchParams.get("websiteId");
  if (!websiteId) return NextResponse.json({ error: "Missing websiteId" }, { status: 400 });

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GitHub OAuth not configured" }, { status: 500 });

  const state = signState(websiteId);

  // Derive the callback URL from the current request origin so this works on any domain
  // (Azure Container App, Pi VPS, local dev) without hardcoded env vars. GitHub will reject
  // redirect_uri values not registered in the OAuth App — add every deployment domain there.
  const requestOrigin = new URL(req.url).origin;
  const redirectUri = `${requestOrigin}/api/github/callback`;

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", "repo");
  authUrl.searchParams.set("state", websiteId);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  // Cookie must be set on the redirect response object directly — cookies() and
  // NextResponse.redirect() are separate response objects; setting via cookies()
  // store does not carry over to the redirect response the browser receives.
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("gh_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
