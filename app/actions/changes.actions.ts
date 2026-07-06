"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, aiSuggestions, cmsConnections } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import type { CmsField } from "@/lib/cms/types";
import { loadCredentials } from "@/lib/cms/credentials";
import { WordPressAdapter } from "@/lib/cms/providers/wordpress";

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

  // Resolve websiteId through the suggestion
  let websiteId: string | null = null;
  if (snapshot.suggestionId) {
    const [suggestion] = await db
      .select({ websiteId: aiSuggestions.websiteId })
      .from(aiSuggestions)
      .where(eq(aiSuggestions.id, snapshot.suggestionId))
      .limit(1);
    websiteId = suggestion?.websiteId ?? null;
  }

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
    let adapter: WordPressAdapter;
    if (cmsType === "wordpress") {
      adapter = new WordPressAdapter();
    } else {
      return { success: false, error: `${cmsType} adapter not yet implemented` };
    }

    const afterState = snapshot.afterState as { value?: string } | null;
    const afterValue = afterState?.value;
    if (!afterValue) return { success: false, error: "No value to push" };

    await adapter.push(
      {
        pageUrl: snapshot.pageUrl,
        fields: { [snapshot.fieldChanged as CmsField]: afterValue },
      },
      credentials as Parameters<WordPressAdapter["push"]>[1],
    );

    await db
      .update(changeSnapshots)
      .set({ status: "applied", cmsConnectionId: connection.id, appliedAt: new Date(), updatedAt: new Date() })
      .where(eq(changeSnapshots.id, snapshotId));

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(changeSnapshots)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(changeSnapshots.id, snapshotId));
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
