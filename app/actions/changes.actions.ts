"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, aiSuggestions, cmsConnections, issues, scans, users } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import type { CmsField, CmsCredentials } from "@/lib/cms/types";
import { loadCredentials } from "@/lib/cms/credentials";
import { WordPressAdapter } from "@/lib/cms/providers/wordpress";
import { ShopifyAdapter } from "@/lib/cms/providers/shopify";
import { WebflowAdapter } from "@/lib/cms/providers/webflow";
import { persistDvsScore } from "@/lib/dvs/score";

async function resolveWebsiteId(snapshot: {
  suggestionId: string | null;
  issueId: string | null;
}): Promise<string | null> {
  if (snapshot.suggestionId) {
    const [s] = await db
      .select({ websiteId: aiSuggestions.websiteId })
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, snapshot.suggestionId))
      .limit(1);
    if (s?.websiteId) return s.websiteId;
  }
  if (snapshot.issueId) {
    const [r] = await db
      .select({ websiteId: scans.websiteId })
      .from(issues)
      .innerJoin(scans, eq(issues.scanId, scans.id))
      .where(eq(issues.id, snapshot.issueId))
      .limit(1);
    if (r?.websiteId) return r.websiteId;
  }
  return null;
}

async function pushViaCmsAdapter(
  cmsType: "wordpress" | "shopify" | "webflow",
  credentials: unknown,
  payload: { pageUrl: string; fields: Partial<Record<CmsField, string>> },
): Promise<CmsField[]> {
  let result;
  if (cmsType === "wordpress") {
    result = await new WordPressAdapter().push(payload, credentials as CmsCredentials["wordpress"]);
  } else if (cmsType === "shopify") {
    result = await new ShopifyAdapter().push(payload, credentials as CmsCredentials["shopify"]);
  } else if (cmsType === "webflow") {
    result = await new WebflowAdapter().push(payload, credentials as CmsCredentials["webflow"]);
  } else {
    throw new Error(`Unsupported CMS type: ${cmsType}`);
  }
  return result.pushedFields;
}

const FIELD_MAP: Record<CmsField, { current: "currentMetaTitle" | "currentMetaDescription" | "currentH1"; suggested: "metaTitle" | "metaDescription" | "h1" }> = {
  meta_title: { current: "currentMetaTitle", suggested: "metaTitle" },
  meta_description: { current: "currentMetaDescription", suggested: "metaDescription" },
  h1: { current: "currentH1", suggested: "h1" },
};

export async function approveSuggestionField(
  suggestionId: string,
  field: CmsField,
): Promise<{ snapshotId: string }> {
  const session = await getServerSession();
  const userId = session.user.id as string;

  const [suggestion] = await db
    .select()
    .from(aiSuggestions)
    .where(eq(aiSuggestions.id, suggestionId))
    .limit(1);

  if (!suggestion) throw new Error("Suggestion not found");

  const { current, suggested } = FIELD_MAP[field];
  const beforeValue = suggestion[current];
  const afterValue = suggestion[suggested];

  if (!afterValue) throw new Error(`No AI suggestion for field ${field}`);

  // Upsert: re-approving the same field updates the snapshot rather than creating a duplicate
  const existing = await db
    .select({ id: changeSnapshots.id })
    .from(changeSnapshots)
    .where(
      and(
        eq(changeSnapshots.suggestionId, suggestionId),
        eq(changeSnapshots.fieldChanged, field),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(changeSnapshots)
      .set({ afterState: { value: afterValue }, status: "pending", updatedAt: new Date() })
      .where(eq(changeSnapshots.id, existing[0].id));
    return { snapshotId: existing[0].id };
  }

  const [inserted] = await db
    .insert(changeSnapshots)
    .values({
      pageUrl: suggestion.pageUrl,
      fieldChanged: field,
      beforeState: { value: beforeValue ?? null },
      afterState: { value: afterValue },
      suggestionId,
      userId,
      status: "pending",
    })
    .returning({ id: changeSnapshots.id });

  return { snapshotId: inserted.id };
}

export async function approveAllSuggestions(suggestionIds: string[]): Promise<void> {
  if (suggestionIds.length === 0) return;
  const session = await getServerSession();
  const userId = session.user.id as string;

  const suggestions = await db
    .select()
    .from(aiSuggestions)
    .where(inArray(aiSuggestions.id, suggestionIds));

  const rows: (typeof changeSnapshots.$inferInsert)[] = [];
  for (const s of suggestions) {
    const fields: Array<{ field: CmsField; before: string | null; after: string }> = [
      { field: "meta_title", before: s.currentMetaTitle, after: s.metaTitle ?? "" },
      { field: "meta_description", before: s.currentMetaDescription, after: s.metaDescription ?? "" },
      { field: "h1", before: s.currentH1, after: s.h1 ?? "" },
    ];
    for (const { field, before, after } of fields) {
      if (!after) continue;
      rows.push({
        pageUrl: s.pageUrl,
        fieldChanged: field,
        beforeState: { value: before ?? null },
        afterState: { value: after },
        suggestionId: s.id,
        userId,
        status: "pending",
      });
    }
  }

  if (rows.length === 0) return;

  // Upsert — re-approving existing pending fields is safe
  await db
    .insert(changeSnapshots)
    .values(rows)
    .onConflictDoNothing();
}

export async function unapproveField(suggestionId: string, field: CmsField): Promise<void> {
  await getServerSession();
  await db
    .delete(changeSnapshots)
    .where(
      and(
        eq(changeSnapshots.suggestionId, suggestionId),
        eq(changeSnapshots.fieldChanged, field),
        eq(changeSnapshots.status, "pending"),
      ),
    );
}

export async function pushChangeTocms(
  snapshotId: string,
): Promise<{ success: boolean; error?: string }> {
  await getServerSession();

  const [snapshot] = await db
    .select()
    .from(changeSnapshots)
    .where(eq(changeSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) return { success: false, error: "Change not found" };
  if (snapshot.status !== "pending") return { success: false, error: "Change is not pending" };

  const websiteId = await resolveWebsiteId(snapshot);
  if (!websiteId) return { success: false, error: "Could not determine website for this change" };

  const [connection] = await db
    .select()
    .from(cmsConnections)
    .where(eq(cmsConnections.websiteId, websiteId))
    .limit(1);

  if (!connection) return { success: false, error: "No CMS connected for this website" };

  const cmsType = connection.cmsType as "wordpress" | "shopify" | "webflow";
  const credentials = await loadCredentials(websiteId, cmsType);
  if (!credentials) return { success: false, error: "Credentials not found — reconnect your CMS" };

  try {
    const afterState = snapshot.afterState as { value?: string } | null;
    const afterValue = afterState?.value;
    if (!afterValue) return { success: false, error: "No value to push" };

    const pushedFields = await pushViaCmsAdapter(cmsType, credentials, {
      pageUrl: snapshot.pageUrl,
      fields: { [snapshot.fieldChanged as CmsField]: afterValue },
    });

    // Verify the adapter actually wrote the requested field. A no-op push
    // (e.g. meta_description on a site with no SEO plugin) returns an empty
    // pushedFields list — treat this as a failure so the UI is honest.
    const fieldWritten = pushedFields.includes(snapshot.fieldChanged as CmsField);
    if (!fieldWritten) {
      await db
        .update(changeSnapshots)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(changeSnapshots.id, snapshotId));
      const fieldLabel = snapshot.fieldChanged === "meta_description" ? "meta description" : snapshot.fieldChanged;
      return {
        success: false,
        error: `Could not write ${fieldLabel} — no SEO plugin (Yoast / Rank Math / AIOSEO) is installed on this WordPress site. Install one to push meta fields.`,
      };
    }

    await db
      .update(changeSnapshots)
      .set({ status: "applied", cmsConnectionId: connection.id, appliedAt: new Date(), updatedAt: new Date() })
      .where(eq(changeSnapshots.id, snapshotId));

    // Recalculate DVS score immediately — resolved issues are now excluded from
    // the penalty, so the score improves without waiting for the next scan.
    void persistDvsScore(websiteId).catch(() => undefined);

    // Mark the parent AI suggestion as applied so it no longer shows in the pending list
    if (snapshot.suggestionId) {
      await db
        .update(aiSuggestions)
        .set({ status: "applied", appliedAt: new Date(), updatedAt: new Date() })
        .where(eq(aiSuggestions.id, snapshot.suggestionId));
    }

    // Mark the linked issue as resolved so it doesn't appear in active issues on next render
    if (snapshot.issueId) {
      await db
        .update(issues)
        .set({ resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(issues.id, snapshot.issueId));
    }

    // Fire-and-forget email — non-blocking, never throws to user
    try {
      const [userRecord] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, snapshot.userId!))
        .limit(1);
      if (userRecord?.email) {
        const { getNotificationProvider } = await import("@/lib/notifications");
        const { pushSuccessTemplate } = await import("@/lib/notifications/email-templates");
        const tmpl = pushSuccessTemplate({
          pageUrl: snapshot.pageUrl,
          fieldChanged: snapshot.fieldChanged,
          afterValue: afterValue,
        });
        void getNotificationProvider().then((p) => p.sendEmail({ to: userRecord.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text }));
      }
    } catch { /* non-critical */ }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(changeSnapshots)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(changeSnapshots.id, snapshotId));

    // Fire-and-forget failure email — non-blocking, never throws to user
    try {
      const [userRecord] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, snapshot.userId!))
        .limit(1);
      if (userRecord?.email) {
        const { getNotificationProvider } = await import("@/lib/notifications");
        const { pushFailureTemplate } = await import("@/lib/notifications/email-templates");
        const tmpl = pushFailureTemplate({
          pageUrl: snapshot.pageUrl,
          fieldChanged: snapshot.fieldChanged,
          error: message,
        });
        void getNotificationProvider().then((p) => p.sendEmail({ to: userRecord.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text }));
      }
    } catch { /* non-critical */ }

    return { success: false, error: message };
  }
}

export async function rejectChange(snapshotId: string): Promise<void> {
  await getServerSession();
  await db
    .update(changeSnapshots)
    .set({ status: "reverted", updatedAt: new Date() })
    .where(and(eq(changeSnapshots.id, snapshotId), eq(changeSnapshots.status, "pending")));
}

export async function rollbackChange(
  snapshotId: string,
): Promise<{ success: boolean; error?: string }> {
  await getServerSession();

  const [snapshot] = await db
    .select()
    .from(changeSnapshots)
    .where(eq(changeSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) return { success: false, error: "Change not found" };
  if (snapshot.status === "rolled_back") return { success: false, error: "already_rolled_back" };
  if (snapshot.status !== "applied") return { success: false, error: "Only applied changes can be rolled back" };

  const websiteId = await resolveWebsiteId(snapshot);
  if (!websiteId) return { success: false, error: "Could not determine website for this change" };

  const [connection] = await db
    .select()
    .from(cmsConnections)
    .where(eq(cmsConnections.websiteId, websiteId))
    .limit(1);

  if (!connection) return { success: false, error: "No CMS connected — cannot rollback" };

  const cmsType = connection.cmsType as "wordpress" | "shopify" | "webflow";
  const credentials = await loadCredentials(websiteId, cmsType);
  if (!credentials) return { success: false, error: "Credentials not found — reconnect your CMS" };

  const beforeState = snapshot.beforeState as { value?: string | null } | null;
  const beforeValue = beforeState?.value ?? "";

  try {
    const pushedFields = await pushViaCmsAdapter(cmsType, credentials, {
      pageUrl: snapshot.pageUrl,
      fields: { [snapshot.fieldChanged as CmsField]: beforeValue },
    });

    // If the adapter wrote nothing (e.g. meta_description with no SEO plugin),
    // the rollback can't restore the original value — surface as an error.
    if (!pushedFields.includes(snapshot.fieldChanged as CmsField)) {
      return { success: false, error: "Could not restore — no SEO plugin installed on this WordPress site" };
    }

    await db
      .update(changeSnapshots)
      .set({ status: "rolled_back", rolledBackAt: new Date(), updatedAt: new Date() })
      .where(eq(changeSnapshots.id, snapshotId));

    // Score goes back down — issue is no longer resolved
    void persistDvsScore(websiteId).catch(() => undefined);

    // Fire-and-forget email — non-blocking, never throws to user
    try {
      const [userRecord] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, snapshot.userId!))
        .limit(1);
      if (userRecord?.email) {
        const { getNotificationProvider } = await import("@/lib/notifications");
        const { rollbackTemplate } = await import("@/lib/notifications/email-templates");
        const tmpl = rollbackTemplate({
          pageUrl: snapshot.pageUrl,
          fieldChanged: snapshot.fieldChanged,
          beforeValue: beforeState?.value ?? null,
        });
        void getNotificationProvider().then((p) => p.sendEmail({ to: userRecord.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text }));
      }
    } catch { /* non-critical */ }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rollback failed";
    return { success: false, error: message };
  }
}

export async function editChangeAfterValue(
  snapshotId: string,
  newValue: string,
): Promise<void> {
  await getServerSession();
  if (!newValue.trim()) throw new Error("Value cannot be empty");
  await db
    .update(changeSnapshots)
    .set({
      afterState: { value: newValue.trim() },
      status: "pending",
      updatedAt: new Date(),
    })
    .where(and(eq(changeSnapshots.id, snapshotId), eq(changeSnapshots.status, "pending")));
}
