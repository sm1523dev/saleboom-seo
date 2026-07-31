"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cmsConnections, scans, issues } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { storeCredentials, deleteCredentials, loadCredentials } from "@/lib/cms/credentials";
import { WordPressAdapter } from "@/lib/cms/providers/wordpress";
import { probeCmsCapabilities } from "@/lib/cms/probe";
import { detectFramework } from "@/lib/cms/github/detect-framework";
import { resolveFixType } from "@/lib/fix-classifier";
import type { CmsType, GitHubFramework } from "@/lib/cms/types";

export type CmsConnectionState =
  | { connected: false }
  | { connected: true; cmsType: CmsType; connectedAs: string; connectedAt: string; connectionId: string; framework?: string };

export type ReclassifyResult = { quickCount: number; majorCount: number };

// After connecting a CMS, probe capabilities and re-classify all issues on the
// latest scan so the results page immediately shows an accurate count.
async function probeAndReclassify(
  websiteId: string,
  cmsType: CmsType,
  credentials: unknown,
): Promise<ReclassifyResult> {
  const capabilities = await probeCmsCapabilities(cmsType, credentials);

  await db
    .update(cmsConnections)
    .set({ capabilities: capabilities as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(and(eq(cmsConnections.websiteId, websiteId), eq(cmsConnections.cmsType, cmsType)));

  const [latestScan] = await db
    .select({ id: scans.id })
    .from(scans)
    .where(and(eq(scans.websiteId, websiteId), eq(scans.status, "completed")))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  if (!latestScan) return { quickCount: 0, majorCount: 0 };

  const allIssues = await db
    .select({
      id: issues.id,
      type: issues.type,
      pageUrl: issues.pageUrl,
      fixType: issues.fixType,
    })
    .from(issues)
    .where(eq(issues.scanId, latestScan.id));

  const toQuick: string[] = [];
  const toMajor: string[] = [];
  let quickCount = 0;
  let majorCount = 0;

  for (const issue of allIssues) {
    const next = resolveFixType(issue.type, issue.pageUrl, capabilities);
    if (next === "quick") quickCount++;
    else majorCount++;
    if (issue.fixType === next) continue;
    if (next === "quick") toQuick.push(issue.id);
    else toMajor.push(issue.id);
  }

  const now = new Date();
  if (toQuick.length > 0) {
    await db
      .update(issues)
      .set({ fixType: "quick", updatedAt: now })
      .where(inArray(issues.id, toQuick));
  }
  if (toMajor.length > 0) {
    await db
      .update(issues)
      .set({ fixType: "major", updatedAt: now })
      .where(inArray(issues.id, toMajor));
  }

  return { quickCount, majorCount };
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
): Promise<{ success: boolean; error?: string; connectedAs?: string; quickCount?: number; majorCount?: number }> {
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

  const counts = await probeAndReclassify(websiteId, "wordpress", creds);
  return { success: true, connectedAs: userLogin, ...counts };
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
): Promise<{ success: boolean; error?: string; connectedAs?: string; quickCount?: number; majorCount?: number }> {
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

  const counts = await probeAndReclassify(websiteId, "shopify", creds);
  return { success: true, connectedAs: userLogin, ...counts };
}

export async function connectWebflow(
  websiteId: string,
  apiToken: string,
  collectionId: string,
): Promise<{ success: boolean; error?: string; connectedAs?: string; quickCount?: number; majorCount?: number }> {
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

  const counts = await probeAndReclassify(websiteId, "webflow", creds);
  return { success: true, connectedAs: userLogin, ...counts };
}

export async function connectGitHub(
  websiteId: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  subPath?: string,
): Promise<{ success: boolean; error?: string; framework?: string; quickCount?: number; majorCount?: number }> {
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

  const counts = await probeAndReclassify(websiteId, "github", fullCreds);
  return { success: true, framework, ...counts };
}

export async function updateGitHubTemplatePaths(
  websiteId: string,
  templatePaths: Record<string, string>,
): Promise<{ success: boolean; error?: string; quickCount?: number; majorCount?: number }> {
  await getServerSession();

  const existing = await loadCredentials(websiteId, "github");
  if (!existing) return { success: false, error: "GitHub not connected — connect your repository first" };

  const merged = { ...existing, templatePaths };
  await storeCredentials(websiteId, "github", merged);

  const counts = await probeAndReclassify(websiteId, "github", merged);
  return { success: true, ...counts };
}

export async function loadCmsCredentials(websiteId: string, cmsType: CmsType) {
  await getServerSession();
  return loadCredentials(websiteId, cmsType);
}
