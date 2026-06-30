"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiSuggestions } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";

export async function dismissSuggestions(suggestionIds: string[]): Promise<void> {
  if (suggestionIds.length === 0) return;
  await getServerSession(); // auth gate

  await db
    .update(aiSuggestions)
    .set({ status: "dismissed", dismissedAt: new Date(), updatedAt: new Date() })
    .where(inArray(aiSuggestions.id, suggestionIds));
}
