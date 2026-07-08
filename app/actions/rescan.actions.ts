"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { websites, scans } from "@/lib/db/schema";
import { queueProvider } from "@/lib/queue";
import { getServerSession } from "@/lib/auth-utils";
import { recordEvent } from "@/lib/metrics";

export async function quickRescanAction(websiteId: string): Promise<{ error?: string }> {
  const session = await getServerSession();

  const [site] = await db
    .select({ id: websites.id, url: websites.url })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .limit(1);

  if (!site) return { error: "Website not found" };

  const [scan] = await db
    .insert(scans)
    .values({ websiteId: site.id, status: "pending" })
    .returning({ id: scans.id });

  await queueProvider.enqueue("scan", { scanId: scan.id, websiteId: site.id, url: site.url });
  await recordEvent("scan.triggered", undefined, { websiteId: site.id, scanId: scan.id });

  redirect(`/scan/${scan.id}`);
}
