"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { websites, scans, aeoQueries } from "@/lib/db/schema";
import { getQueueProvider } from "@/lib/queue";
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

  let scanId: string;
  try {
    const [hasAeoQ] = await db
      .select({ id: aeoQueries.id })
      .from(aeoQueries)
      .where(and(eq(aeoQueries.websiteId, site.id), eq(aeoQueries.active, true)))
      .limit(1);
    const aeoExpected = !!hasAeoQ;

    const [scan] = await db
      .insert(scans)
      .values({ websiteId: site.id, status: "pending", aeoExpected })
      .returning({ id: scans.id });

    const queue = await getQueueProvider();
    await Promise.all([
      queue.enqueue("scan", { scanId: scan.id, websiteId: site.id, url: site.url }),
      ...(aeoExpected ? [queue.enqueue("aeo-scan", { websiteId: site.id, scanId: scan.id })] : []),
    ]);
    await recordEvent("scan.triggered", undefined, { websiteId: site.id, scanId: scan.id });
    scanId = scan.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to trigger rescan" };
  }

  redirect(`/scan/${scanId}`);
}
