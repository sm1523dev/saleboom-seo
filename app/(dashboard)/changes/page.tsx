import type { Metadata } from "next";
import { eq, desc, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, aiSuggestions, issues, scans, websites, cmsConnections } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { ApprovalQueue } from "./_components/approval-queue";

export const metadata: Metadata = {
  title: "Approval Queue",
  robots: { index: false, follow: false },
};

export default async function ChangesPage() {
  await getServerSession();

  // Fetch all pending snapshots — no pagination, grouped by website
  const pending = await db
    .select({
      id: changeSnapshots.id,
      pageUrl: changeSnapshots.pageUrl,
      fieldChanged: changeSnapshots.fieldChanged,
      beforeState: changeSnapshots.beforeState,
      afterState: changeSnapshots.afterState,
      createdAt: changeSnapshots.createdAt,
      suggestionId: changeSnapshots.suggestionId,
      issueId: changeSnapshots.issueId,
      suggestionWebsiteId: aiSuggestions.websiteId,
    })
    .from(changeSnapshots)
    .leftJoin(aiSuggestions, eq(changeSnapshots.suggestionId, aiSuggestions.id))
    .where(and(eq(changeSnapshots.status, "pending"), isNull(changeSnapshots.deletedAt)))
    .orderBy(desc(changeSnapshots.createdAt));

  // Resolve websiteId for snapshots that came from issues (not suggestions)
  const issueIds = pending
    .filter((r) => !r.suggestionWebsiteId && r.issueId)
    .map((r) => r.issueId as string);

  const issueWebsiteMap = new Map<string, string>();
  if (issueIds.length > 0) {
    const rows = await db
      .select({ issueId: issues.id, websiteId: scans.websiteId })
      .from(issues)
      .innerJoin(scans, eq(issues.scanId, scans.id))
      .where(inArray(issues.id, issueIds));
    for (const r of rows) issueWebsiteMap.set(r.issueId, r.websiteId);
  }

  // Resolve final websiteId per snapshot
  const enriched = pending.map((r) => ({
    ...r,
    websiteId: r.suggestionWebsiteId ?? (r.issueId ? issueWebsiteMap.get(r.issueId) ?? null : null),
  }));

  // Fetch website names + CMS connections for all websiteIds
  const allWebsiteIds = [...new Set(enriched.map((r) => r.websiteId).filter(Boolean))] as string[];

  const [websiteRows, cmsRows] = await Promise.all([
    allWebsiteIds.length > 0
      ? db.select({ id: websites.id, name: websites.name, url: websites.url, platformHint: websites.platformHint })
          .from(websites)
          .where(inArray(websites.id, allWebsiteIds))
      : Promise.resolve([]),
    allWebsiteIds.length > 0
      ? db.select({ websiteId: cmsConnections.websiteId, cmsType: cmsConnections.cmsType })
          .from(cmsConnections)
          .where(and(inArray(cmsConnections.websiteId, allWebsiteIds), isNull(cmsConnections.deletedAt)))
      : Promise.resolve([]),
  ]);

  const websiteMap = new Map(websiteRows.map((w) => [w.id, w]));
  const connectedSet = new Set(cmsRows.map((c) => c.websiteId));
  const cmsTypeMap = new Map(cmsRows.map((c) => [c.websiteId, c.cmsType]));

  // H1 can only be auto-pushed for CMS platforms that own the heading natively.
  // On custom code sites (github) it lives in source files and needs a manual edit.
  const H1_AUTOPUSH_TYPES = new Set(["wordpress", "shopify", "webflow"]);
  function getBlockReason(field: string, cmsType: string | null): string | null {
    if (field === "h1" && cmsType !== null && !H1_AUTOPUSH_TYPES.has(cmsType))
      return "H1 in source code requires manual edit — use meta_title as a proxy instead";
    return null;
  }

  const items = enriched.map((r) => {
    const website = r.websiteId ? websiteMap.get(r.websiteId) : null;
    const cmsType = r.websiteId ? (cmsTypeMap.get(r.websiteId) ?? null) : null;
    const blockReason = getBlockReason(r.fieldChanged, cmsType);
    return {
      id: r.id,
      pageUrl: r.pageUrl,
      fieldChanged: r.fieldChanged,
      beforeValue: (r.beforeState as { value?: string } | null)?.value ?? null,
      afterValue: (r.afterState as { value?: string } | null)?.value ?? "",
      createdAt: r.createdAt.toISOString(),
      websiteId: r.websiteId ?? null,
      websiteName: website?.name ?? null,
      websiteUrl: website?.url ?? null,
      platformHint: website?.platformHint ?? null,
      isCmsConnected: r.websiteId ? connectedSet.has(r.websiteId) : false,
      cmsType,
      canAutoPush: blockReason === null,
      blockReason,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated fixes ready to push to your CMS — grouped by website.
        </p>
      </header>
      <ApprovalQueue items={items} />
    </div>
  );
}
