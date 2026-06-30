import { redirect, notFound } from "next/navigation";
import { eq, and, isNull, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";

export default async function SeoIntelligencePage() {
  const session = await getServerSession();

  const userWebsites = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)));

  if (userWebsites.length === 0) redirect("/scan");

  const websiteIds = userWebsites.map((w) => w.id);

  const [latestScan] = await db
    .select({ id: scans.id })
    .from(scans)
    .where(and(inArray(scans.websiteId, websiteIds), eq(scans.status, "completed"), isNull(scans.deletedAt)))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  if (!latestScan) redirect("/scan");

  redirect(`/scan/${latestScan.id}/results`);
}
