import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cmsConnections } from "@/lib/db/schema";
import { storeCredentials } from "@/lib/cms/credentials";

function verifyState(websiteId: string, cookieState: string): boolean {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) return false;
  const hmac = createHmac("sha256", pepper).update(websiteId).digest("hex").slice(0, 16);
  const expected = `${websiteId}:${hmac}`;
  return cookieState === expected;
}

export async function GET(req: Request): Promise<NextResponse> {
  // Derive app URL from request — prefer x-forwarded-proto/host (set by reverse proxies
  // and Azure Container Apps ingress) over req.url, which has http://0.0.0.0:3000 inside
  // the container. NEXT_PUBLIC_APP_URL is intentionally NOT used; it may hold the wrong
  // domain if the env var was set for a different environment.
  const reqUrl = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? reqUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? reqUrl.host;
  const appUrl = `${proto}://${host}`;

  const { searchParams } = reqUrl;
  const code = searchParams.get("code");
  const websiteId = searchParams.get("state");

  if (!code || !websiteId) {
    return NextResponse.redirect(`${appUrl}/dashboard?github_error=missing_params`);
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get("gh_oauth_state")?.value ?? "";

  if (!verifyState(websiteId, cookieState)) {
    return NextResponse.redirect(`${appUrl}/dashboard?github_error=csrf`);
  }

  cookieStore.delete("gh_oauth_state");
  const returnScanId = cookieStore.get("gh_return_scan")?.value;
  if (returnScanId) cookieStore.delete("gh_return_scan");

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard?github_error=not_configured`);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/website/${websiteId}/cms?github_error=token_exchange`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/website/${websiteId}/cms?github_error=no_token`);
  }

  // Get GitHub user login
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "SaleBoomSEO",
    },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${appUrl}/website/${websiteId}/cms?github_error=user_fetch`);
  }

  const userData = (await userRes.json()) as { login: string };

  // Store partial credentials (repo details filled in step 2)
  const storageKey = await storeCredentials(websiteId, "github", {
    accessToken: tokenData.access_token,
    repoOwner: "",
    repoName: "",
    baseBranch: "main",
    framework: "unknown",
  });

  await db
    .insert(cmsConnections)
    .values({
      websiteId,
      cmsType: "github",
      credentialsRef: `${storageKey}|${userData.login}`,
      connectedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [cmsConnections.websiteId, cmsConnections.cmsType],
      set: {
        credentialsRef: `${storageKey}|${userData.login}`,
        connectedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  const stepQs = new URLSearchParams({ github_step: "2" });
  if (returnScanId) stepQs.set("returnScanId", returnScanId);
  return NextResponse.redirect(`${appUrl}/website/${websiteId}/cms?${stepQs.toString()}`);
}
