"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { findLinkOpportunities, type LinkOpportunity, type PageData } from "@/lib/internal-links/analyzer";

export type { LinkOpportunity };

export async function getInternalLinkOpportunities(
  websiteId: string,
): Promise<LinkOpportunity[] | { error: string }> {
  const session = await getServerSession();

  const [site] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .limit(1);

  if (!site) return { error: "Website not found" };

  const [latestScan] = await db
    .select({ rawCrawl: scans.rawCrawl })
    .from(scans)
    .where(and(eq(scans.websiteId, websiteId), eq(scans.status, "completed"), isNull(scans.deletedAt)))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  if (!latestScan?.rawCrawl) return { error: "No completed scan found. Run a scan first." };

  const raw = latestScan.rawCrawl as {
    pages?: Array<{ url: string; title?: string; h1s?: string[]; links?: string[] }>;
  };

  const pages: PageData[] = (raw.pages ?? []).map((p) => ({
    url: p.url,
    title: p.title ?? null,
    h1: p.h1s?.[0] ?? null,
    outboundLinks: (p.links ?? []).filter((l: string) => l.startsWith("http")),
  }));

  if (pages.length < 2) return { error: "Need at least 2 crawled pages to detect linking opportunities." };

  return findLinkOpportunities(pages);
}
