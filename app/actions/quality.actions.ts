"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, cmsConnections, websites } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { notifyAlert } from "@/lib/metrics/notify";
import { loadCredentials, storeCredentials } from "@/lib/cms/credentials";
import type { GitHubFramework } from "@/lib/cms/types";

export async function flagPushQuality(
  snapshotId: string,
  comment?: string,
): Promise<{ success: boolean }> {
  await getServerSession();

  const [snap] = await db
    .select({ pageUrl: changeSnapshots.pageUrl, fieldChanged: changeSnapshots.fieldChanged })
    .from(changeSnapshots)
    .where(eq(changeSnapshots.id, snapshotId))
    .limit(1);

  await db
    .update(changeSnapshots)
    .set({
      qualityFlagged: true,
      qualityFlagComment: comment?.trim() || null,
      qualityFlaggedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changeSnapshots.id, snapshotId));

  // Fire-and-forget alert to admin
  const msg = [
    `⚠️ Push quality flag raised`,
    `Page: ${snap?.pageUrl ?? "unknown"}`,
    `Field: ${snap?.fieldChanged ?? "unknown"}`,
    comment ? `Comment: ${comment.trim()}` : null,
    `Snapshot: ${snapshotId}`,
  ].filter(Boolean).join("\n");

  void notifyAlert(msg).catch(() => undefined);

  return { success: true };
}

export async function updateGitHubFramework(
  websiteId: string,
  newFramework: GitHubFramework,
): Promise<{ success: boolean; error?: string }> {
  await getServerSession();

  const creds = await loadCredentials(websiteId, "github");
  if (!creds) return { success: false, error: "GitHub not connected" };

  const updated = { ...(creds as object), framework: newFramework } as typeof creds;
  await storeCredentials(websiteId, "github", updated);

  // Increment wrong framework counter on the connection
  await db
    .update(cmsConnections)
    .set({
      wrongFrameworkCount: sql`${cmsConnections.wrongFrameworkCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(cmsConnections.websiteId, websiteId));

  return { success: true };
}
