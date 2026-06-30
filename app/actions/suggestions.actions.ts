"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiSuggestions } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";

export async function ignoreSuggestions(suggestionIds: string[]): Promise<void> {
  if (suggestionIds.length === 0) return;
  await getServerSession();
  await db
    .update(aiSuggestions)
    .set({ status: "dismissed", dismissedAt: new Date(), updatedAt: new Date() })
    .where(inArray(aiSuggestions.id, suggestionIds));
}

export async function unignoreSuggestions(suggestionIds: string[]): Promise<void> {
  if (suggestionIds.length === 0) return;
  await getServerSession();
  await db
    .update(aiSuggestions)
    .set({ status: "pending", dismissedAt: null, updatedAt: new Date() })
    .where(inArray(aiSuggestions.id, suggestionIds));
}
