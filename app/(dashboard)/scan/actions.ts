"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans, aeoProviders } from "@/lib/db/schema";
import { queueProvider } from "@/lib/queue";
import { getServerSession } from "@/lib/auth-utils";
import { parseWebsiteUrl } from "@/lib/form-validation";
import { seedDefaultProviders, seedDefaultQueries } from "@/lib/aeo/seed-providers";

export type ScanActionState = { error: string } | null;

export async function startScanAction(
  _prevState: ScanActionState,
  formData: FormData
): Promise<ScanActionState> {
  const session = await getServerSession();

  let url: string;
  try {
    url = parseWebsiteUrl(formData.get("url"));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid URL." };
  }

  // Upsert website — reuse existing record if this user already has this URL
  const existing = await db
    .select({ id: websites.id })
    .from(websites)
    .where(
      and(eq(websites.userId, session.user.id), eq(websites.url, url))
    )
    .limit(1);

  let websiteId: string;
  let isNewWebsite = false;

  if (existing.length > 0) {
    websiteId = existing[0].id;
  } else {
    const hostname = new URL(url).hostname;
    const [website] = await db
      .insert(websites)
      .values({ userId: session.user.id, url, name: hostname })
      .returning({ id: websites.id });
    websiteId = website.id;
    isNewWebsite = true;
  }

  // Seed AEO providers + queries on first scan per website
  if (isNewWebsite) {
    const hostname = new URL(url).hostname;
    await seedDefaultProviders(websiteId);
    await seedDefaultQueries(websiteId, hostname, url);
  } else {
    // Existing website — seed providers/queries if somehow missing
    const [hasProvider] = await db
      .select({ id: aeoProviders.id })
      .from(aeoProviders)
      .where(eq(aeoProviders.websiteId, websiteId))
      .limit(1);
    if (!hasProvider) {
      const hostname = new URL(url).hostname;
      await seedDefaultProviders(websiteId);
      await seedDefaultQueries(websiteId, hostname, url);
    }
  }

  // Create scan record
  const [scan] = await db
    .insert(scans)
    .values({ websiteId, status: "pending", startedAt: new Date() })
    .returning({ id: scans.id });

  // Enqueue SEO scan + AEO scan in parallel
  await Promise.all([
    queueProvider.enqueue("scan", { scanId: scan.id, websiteId, url }),
    queueProvider.enqueue("aeo-scan", { websiteId }),
  ]);

  redirect(`/scan/${scan.id}`);
}
