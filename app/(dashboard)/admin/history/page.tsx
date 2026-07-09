import type { Metadata } from "next";
import { desc, and, isNull, inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, users, websites, aiSuggestions, issues, scans } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-utils";
import { AdminHistoryLog } from "./_components/admin-history-log";

export const metadata: Metadata = {
  title: "Admin · Change History",
  robots: { index: false, follow: false },
};

export default async function AdminHistoryPage() {
  await requireAdmin();

  const records = await db
    .select({
      id: changeSnapshots.id,
      pageUrl: changeSnapshots.pageUrl,
      fieldChanged: changeSnapshots.fieldChanged,
      beforeState: changeSnapshots.beforeState,
      afterState: changeSnapshots.afterState,
      status: changeSnapshots.status,
      appliedAt: changeSnapshots.appliedAt,
      createdAt: changeSnapshots.createdAt,
      userId: changeSnapshots.userId,
      suggestionId: changeSnapshots.suggestionId,
      issueId: changeSnapshots.issueId,
      suggestionWebsiteId: aiSuggestions.websiteId,
    })
    .from(changeSnapshots)
    .leftJoin(aiSuggestions, eq(changeSnapshots.suggestionId, aiSuggestions.id))
    .where(
      and(
        isNull(changeSnapshots.deletedAt),
        inArray(changeSnapshots.status, ["applied", "rolled_back", "failed", "reverted"]),
      ),
    )
    .orderBy(desc(changeSnapshots.createdAt))
    .limit(500);

  // Resolve website IDs for snapshots that came from issues
  const issueIds = records
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

  // Fetch users and websites
  const userIds = [...new Set(records.map((r) => r.userId).filter(Boolean))] as string[];
  const websiteIds = [
    ...new Set(
      records.map((r) => r.suggestionWebsiteId ?? (r.issueId ? issueWebsiteMap.get(r.issueId) ?? null : null)).filter(Boolean),
    ),
  ] as string[];

  const [userRows, websiteRows] = await Promise.all([
    userIds.length > 0
      ? db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
    websiteIds.length > 0
      ? db.select({ id: websites.id, name: websites.name, url: websites.url }).from(websites).where(inArray(websites.id, websiteIds))
      : Promise.resolve([]),
  ]);

  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const websiteMap = new Map(websiteRows.map((w) => [w.id, w]));

  // Group: userId → websiteId → changes
  type ChangeItem = {
    id: string;
    pageUrl: string;
    fieldChanged: string;
    beforeValue: string | null;
    afterValue: string;
    status: string;
    appliedAt: string | null;
    createdAt: string;
  };
  const grouped = new Map<string, Map<string | null, ChangeItem[]>>();

  for (const r of records) {
    const userId = r.userId ?? "unknown";
    const websiteId = r.suggestionWebsiteId ?? (r.issueId ? issueWebsiteMap.get(r.issueId) ?? null : null);

    if (!grouped.has(userId)) grouped.set(userId, new Map());
    const byWebsite = grouped.get(userId)!;
    if (!byWebsite.has(websiteId)) byWebsite.set(websiteId, []);

    byWebsite.get(websiteId)!.push({
      id: r.id,
      pageUrl: r.pageUrl,
      fieldChanged: r.fieldChanged,
      beforeValue: (r.beforeState as { value?: string } | null)?.value ?? null,
      afterValue: (r.afterState as { value?: string } | null)?.value ?? "",
      status: r.status,
      appliedAt: r.appliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    });
  }

  const groups = Array.from(grouped.entries()).map(([userId, byWebsite]) => {
    const user = userMap.get(userId);
    return {
      userId,
      userEmail: user?.email ?? "Unknown",
      userName: user?.name ?? null,
      websites: Array.from(byWebsite.entries()).map(([websiteId, changes]) => {
        const site = websiteId ? websiteMap.get(websiteId) : null;
        const applied = changes.filter((c) => c.appliedAt);
        const lastApplied = applied.length > 0
          ? applied.reduce((a, b) => (a.appliedAt! > b.appliedAt! ? a : b)).appliedAt
          : null;
        return {
          websiteId,
          websiteName: site?.name ?? null,
          websiteUrl: site?.url ?? null,
          totalFixes: changes.length,
          lastApplied,
          changes,
        };
      }),
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Change History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All SEO fixes pushed by users — grouped by user and website.
        </p>
      </header>

      <AdminHistoryLog groups={groups} />
    </div>
  );
}
