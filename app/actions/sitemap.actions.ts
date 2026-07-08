"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";

export type SitemapAnalysis = {
  websiteUrl: string;
  crawledUrls: string[];
  sitemapUrls: string[];
  inCrawlNotSitemap: string[];
  inSitemapNotCrawl: string[];
  generatedXml: string;
};

export async function analyzeSitemap(
  websiteId: string,
): Promise<SitemapAnalysis | { error: string }> {
  const session = await getServerSession();

  const [site] = await db
    .select({ id: websites.id, url: websites.url })
    .from(websites)
    .where(
      and(
        eq(websites.id, websiteId),
        eq(websites.userId, session.user.id),
        isNull(websites.deletedAt),
      ),
    )
    .limit(1);

  if (!site) return { error: "Website not found" };

  const [latestScan] = await db
    .select({ rawCrawl: scans.rawCrawl })
    .from(scans)
    .where(
      and(
        eq(scans.websiteId, websiteId),
        eq(scans.status, "completed"),
        isNull(scans.deletedAt),
      ),
    )
    .orderBy(desc(scans.completedAt))
    .limit(1);

  if (!latestScan?.rawCrawl)
    return { error: "No completed scan found. Run a scan first." };

  const rawCrawl = latestScan.rawCrawl as {
    pages?: Array<{ url: string }>;
  };
  const crawledUrls = (rawCrawl.pages ?? [])
    .map((p) => p.url)
    .filter((u) => u.startsWith("http"));

  // Fetch sitemap.xml live from the target website
  let sitemapUrls: string[] = [];
  try {
    const res = await fetch(
      `${site.url.replace(/\/$/, "")}/sitemap.xml`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const xml = await res.text();
      const matches = xml.match(/<loc>([\s\S]*?)<\/loc>/gi) ?? [];
      sitemapUrls = matches
        .map((m) => m.replace(/<\/?loc>/gi, "").trim())
        .filter((u) => u.startsWith("http"));
    }
  } catch {
    // sitemap unreachable — proceed with empty list
  }

  const crawledSet = new Set(crawledUrls);
  const sitemapSet = new Set(sitemapUrls);

  const inCrawlNotSitemap = crawledUrls.filter((u) => !sitemapSet.has(u));
  const inSitemapNotCrawl = sitemapUrls.filter((u) => !crawledSet.has(u));

  const today = new Date().toISOString().split("T")[0];
  const urlEntries = crawledUrls
    .map(
      (u) =>
        `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    )
    .join("\n");
  const generatedXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;

  return {
    websiteUrl: site.url,
    crawledUrls,
    sitemapUrls,
    inCrawlNotSitemap,
    inSitemapNotCrawl,
    generatedXml,
  };
}
