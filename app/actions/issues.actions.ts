"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { issues } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";

export async function ignoreIssues(issueIds: string[]): Promise<void> {
  if (issueIds.length === 0) return;
  await getServerSession();

  await db
    .update(issues)
    .set({ ignoredAt: new Date(), updatedAt: new Date() })
    .where(inArray(issues.id, issueIds));
}
