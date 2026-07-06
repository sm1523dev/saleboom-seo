"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { cmsConnections } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { storeCredentials, deleteCredentials, loadCredentials } from "@/lib/cms/credentials";
import { WordPressAdapter } from "@/lib/cms/providers/wordpress";
import type { CmsType } from "@/lib/cms/types";

export type CmsConnectionState =
  | { connected: false }
  | { connected: true; cmsType: CmsType; connectedAs: string; connectedAt: string; connectionId: string };

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
  return {
    connected: true,
    cmsType,
    connectedAs: hint,
    connectedAt: conn.connectedAt.toISOString(),
    connectionId: conn.id,
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

  return { success: true, connectedAs: userLogin };
}

export async function disconnectCms(websiteId: string, cmsType: CmsType): Promise<void> {
  await getServerSession();
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

  return { success: true, connectedAs: userLogin };
}

export async function loadCmsCredentials(websiteId: string, cmsType: CmsType) {
  await getServerSession();
  return loadCredentials(websiteId, cmsType);
}
