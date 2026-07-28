"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cmsConnections, scans, issues } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { storeCredentials, deleteCredentials, loadCredentials } from "@/lib/cms/credentials";
import { WordPressAdapter } from "@/lib/cms/providers/wordpress";
import { probeCmsCapabilities, type CmsCapabilities } from "@/lib/cms/probe";
import { detectFramework } from "@/lib/cms/github/detect-framework";
import { ISSUE_TYPE_TO_FIELD } from "@/lib/fix-classifier";
import type { CmsType, GitHubFramework } from "@/lib/cms/types";

export type CmsConnectionState =
  | { connected: false }
  | { connected: true; cmsType: CmsType; connectedAs: string; connectedAt: string; connectionId: string; framework?: string };

// After connecting a CMS, probe capabilities and re-classify quick fixes on the
// latest scan so the results page immediately shows an accurate count.
async function probeAndReclassify(
  websiteId: string,
  cmsType: CmsType,
  credentials: unknown,
): Promise<void> {
  const capabilities = await probeCmsCapabilities(cmsType, credentials);

  await db
    .update(cmsConnections)
    .set({ capabilities: capabilities as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(and(eq(cmsConnections.websiteId, websiteId), eq(cmsConnections.cmsType, cmsType)));

  // Re-classify quick-fix issues on the latest completed scan
  const [latestScan] = await db
    .select({ id: scans.id })
    .from(scans)
    .where(and(eq(scans.websiteId, websiteId), eq(scans.status, "completed")))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  if (!latestScan) return;

  const quickIssues = await db
    .select({ id: issues.id, type: issues.type })
    .from(issues)
    .where(and(eq(issues.scanId, latestScan.id), eq(issues.fixType, "quick")));

  for (const issue of quickIssues) {
    const field = ISSUE_TYPE_TO_FIELD[issue.type];
    if (!field) continue;
    const canFix = field === "meta_title" ? capabilities.meta_title
      : field === "meta_description" ? capabilities.meta_description
      : capabilities.h1;
    if (!canFix) {
      await db
        .update(issues)
        .set({ fixType: "major", updatedAt: new Date() })
        .where(eq(issues.id, issue.id));
    }
  }
}

export async function getCmsConnection(websiteId: string): Promise<CmsConnectionState> {
  await getServerSession();
  const [conn] = await db
    .select()
    .from(cmsConnections)
    .where(and(eq(cmsConnections.websiteId, websiteId)))
    .limit(1);
  if (!conn || !conn.connectedAt) return { connected: false };
  const cmsType = conn.cmsType as CmsType;
  // credentialsRef stores the masked login hint as "<storageKey>|<userLogin>"
  const hint = conn.credentialsRef?.split("|")[1] ?? "";
  let framework: string | undefined;
  if (cmsType === "github") {
    const creds = await loadCredentials(websiteId, "github").catch(() => null);
    framework = (creds as { framework?: string } | null)?.framework;
  }
  return {
    connected: true,
    cmsType,
    connectedAs: hint,
    connectedAt: conn.connectedAt.toISOString(),
    connectionId: conn.id,
    framework,
  };
}

export async function connectWordPress(
  websiteId: string,
  siteUrl: string,
  username: string,
  applicationPassword: string,
): Promise<{ success: boolean; error?: string; connectedAs?: string }> {
  await getServerSession();

  const creds = { siteUrl, username, applicationPassword };
  const adapter = new WordPressAdapter();

  const validation = await adapter.validate(creds);
  if (!validation.valid) return { success: false, error: validation.error };

  const storageKey = await storeCredentials(websiteId, "wordpress", creds);
  const userLogin = validation.userLogin ?? username;

  await db
    .insert(cmsConnections)
    .values({
      websiteId,
      cmsType: "wordpress",
      credentialsRef: `${storageKey}|${userLogin}`,
      connectedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [cmsConnections.websiteId, cmsConnections.cmsType],
      set: {
        credentialsRef: `${storageKey}|${userLogin}`,
        connectedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  void probeAndReclassify(websiteId, "wordpress", creds).catch(() => undefined);
  return { success: true, connectedAs: userLogin };
}

export async function disconnectCms(websiteId: string, cmsType: CmsType): Promise<void> {
  await getServerSession();

  if (cmsType === "github") {
    const creds = await loadCredentials(websiteId, "github").catch(() => null);
    if (creds?.webhookId) {
      await fetch(
        `https://api.github.com/repos/${creds.repoOwner}/${creds.repoName}/hooks/${creds.webhookId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${creds.accessToken}`, "User-Agent": "SaleBoomSEO" },
        },
      ).catch(() => undefined);
    }
  }

  await deleteCredentials(websiteId, cmsType);
  await db
    .delete(cmsConnections)
    .where(and(eq(cmsConnections.websiteId, websiteId), eq(cmsConnections.cmsType, cmsType)));
}

export async function connectShopify(
  websiteId: string,
  storeUrl: string,
  accessToken: string,
): Promise<{ success: boolean; error?: string; connectedAs?: string }> {
  await getServerSession();
  const { ShopifyAdapter } = await import("@/lib/cms/providers/shopify");
  const creds = { storeUrl, accessToken };
  const validation = await new ShopifyAdapter().validate(creds);
  if (!validation.valid) return { success: false, error: validation.error };

  const storageKey = await storeCredentials(websiteId, "shopify", creds);
  const userLogin = validation.userLogin ?? storeUrl;

  await db
    .insert(cmsConnections)
    .values({ websiteId, cmsType: "shopify", credentialsRef: `${storageKey}|${userLogin}`, connectedAt: new Date() })
    .onConflictDoUpdate({
      target: [cmsConnections.websiteId, cmsConnections.cmsType],
      set: { credentialsRef: `${storageKey}|${userLogin}`, connectedAt: new Date(), updatedAt: new Date() },
    });

  void probeAndReclassify(websiteId, "shopify", creds).catch(() => undefined);
  return { success: true, connectedAs: userLogin };
}

export async function connectWebflow(
  websiteId: string,
  apiToken: string,
  collectionId: string,
): Promise<{ success: boolean; error?: string; connectedAs?: string }> {
  await getServerSession();
  const { WebflowAdapter } = await import("@/lib/cms/providers/webflow");
  const creds = { apiToken, collectionId };
  const validation = await new WebflowAdapter().validate(creds);
  if (!validation.valid) return { success: false, error: validation.error };

  const storageKey = await storeCredentials(websiteId, "webflow", creds);
  const userLogin = validation.userLogin ?? "Webflow";

  await db
    .insert(cmsConnections)
    .values({ websiteId, cmsType: "webflow", credentialsRef: `${storageKey}|${userLogin}`, connectedAt: new Date() })
    .onConflictDoUpdate({
      target: [cmsConnections.websiteId, cmsConnections.cmsType],
      set: { credentialsRef: `${storageKey}|${userLogin}`, connectedAt: new Date(), updatedAt: new Date() },
    });

  void probeAndReclassify(websiteId, "webflow", creds).catch(() => undefined);
  return { success: true, connectedAs: userLogin };
}

export async function connectGitHub(
  websiteId: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  subPath?: string,
): Promise<{ success: boolean; error?: string; framework?: string }> {
  await getServerSession();

  // Load partial credentials stored by the OAuth callback
  const partial = await loadCredentials(websiteId, "github");
  if (!partial?.accessToken) {
    return { success: false, error: "GitHub not authorized — click 'Connect GitHub' to start OAuth flow" };
  }

  const framework = await detectFramework(repoOwner, repoName, partial.accessToken, subPath).catch(
    () => "unknown" as GitHubFramework,
  );

  // Retrieve connection id + existing credentialsRef before updating
  const [conn] = await db
    .select({ id: cmsConnections.id, credentialsRef: cmsConnections.credentialsRef })
    .from(cmsConnections)
    .where(and(eq(cmsConnections.websiteId, websiteId), eq(cmsConnections.cmsType, "github")))
    .limit(1);

  const connectionId = conn?.id;
  const loginHint = conn?.credentialsRef?.split("|")[1] ?? repoOwner;

  // Register (or re-register) GitHub webhook for real-time PR events
  let webhookSecret = partial.webhookSecret;
  let webhookId = partial.webhookId;

  if (connectionId) {
    // Derive app URL from forwarded headers (server action has no request object)
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const webhookUrl = `${proto}://${host}/api/github/webhook/${connectionId}`;

    // Delete the old webhook if we have its ID (e.g. user is re-connecting)
    if (webhookId) {
      await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/hooks/${webhookId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${partial.accessToken}`, "User-Agent": "SaleBoomSEO" },
        },
      ).catch(() => undefined);
    }

    // Generate a fresh secret and register the webhook
    webhookSecret = randomBytes(32).toString("hex");
    const hookRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/hooks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${partial.accessToken}`,
          "User-Agent": "SaleBoomSEO",
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["pull_request"],
          config: { url: webhookUrl, content_type: "json", secret: webhookSecret, insecure_ssl: "0" },
        }),
      },
    );

    if (hookRes.ok) {
      const hook = (await hookRes.json()) as { id: number };
      webhookId = hook.id;
    } else {
      // Non-fatal — PR status can still be checked manually via "Check status" button
      webhookSecret = undefined;
      webhookId = undefined;
    }
  }

  const fullCreds = {
    accessToken: partial.accessToken,
    repoOwner,
    repoName,
    baseBranch,
    framework,
    subPath,
    webhookSecret,
    webhookId,
  };
  const storageKey = await storeCredentials(websiteId, "github", fullCreds);

  await db
    .update(cmsConnections)
    .set({ credentialsRef: `${storageKey}|${loginHint}`, updatedAt: new Date() })
    .where(and(eq(cmsConnections.websiteId, websiteId), eq(cmsConnections.cmsType, "github")));

  void probeAndReclassify(websiteId, "github", fullCreds).catch(() => undefined);
  return { success: true, framework };
}

export async function updateGitHubTemplatePaths(
  websiteId: string,
  templatePaths: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  await getServerSession();

  const existing = await loadCredentials(websiteId, "github");
  if (!existing) return { success: false, error: "GitHub not connected — connect your repository first" };

  const merged = { ...existing, templatePaths };
  await storeCredentials(websiteId, "github", merged);

  // Re-probe so capabilities are updated (django/laravel flip from major → quick)
  void probeAndReclassify(websiteId, "github", merged).catch(() => undefined);
  return { success: true };
}

export async function loadCmsCredentials(websiteId: string, cmsType: CmsType) {
  await getServerSession();
  return loadCredentials(websiteId, cmsType);
}
