import type { Metadata } from "next";
import { desc, and, isNull, inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, cmsConnections } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { ChangeHistoryLog } from "../_components/change-history-log";

export const metadata: Metadata = {
  title: "Change History",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<{ page?: string; cmsType?: string; status?: string }>;
};

export default async function ChangeHistoryPage({ searchParams }: Props) {
  const { page, cmsType, status } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));

  const statusFilter = status && ["applied", "rolled_back"].includes(status) ? status : undefined;
  const cmsTypeFilter = cmsType && ["wordpress", "shopify", "webflow"].includes(cmsType) ? cmsType : undefined;

  const session = await getServerSession();

  const conditions = [
    isNull(changeSnapshots.deletedAt),
    inArray(changeSnapshots.status, ["applied", "rolled_back", "failed", "reverted"]),
    eq(changeSnapshots.userId, session.user.id as string),
  ];

  const records = await db
    .select({
      id: changeSnapshots.id,
      pageUrl: changeSnapshots.pageUrl,
      fieldChanged: changeSnapshots.fieldChanged,
      beforeState: changeSnapshots.beforeState,
      afterState: changeSnapshots.afterState,
      status: changeSnapshots.status,
      appliedAt: changeSnapshots.appliedAt,
      rolledBackAt: changeSnapshots.rolledBackAt,
      createdAt: changeSnapshots.createdAt,
      cmsConnectionId: changeSnapshots.cmsConnectionId,
    })
    .from(changeSnapshots)
    .where(and(...conditions))
    .orderBy(desc(changeSnapshots.createdAt))
    .limit(PAGE_SIZE)
    .offset((pageNum - 1) * PAGE_SIZE);

  // Fetch CMS types for each connection referenced
  const connectionIds = [...new Set(records.map((r) => r.cmsConnectionId).filter(Boolean))] as string[];
  const connectionMap: Record<string, string> = {};
  if (connectionIds.length > 0) {
    const conns = await db
      .select({ id: cmsConnections.id, cmsType: cmsConnections.cmsType })
      .from(cmsConnections)
      .where(inArray(cmsConnections.id, connectionIds));
    for (const c of conns) connectionMap[c.id] = c.cmsType;
  }

  const items = records
    .filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (cmsTypeFilter && r.cmsConnectionId && connectionMap[r.cmsConnectionId] !== cmsTypeFilter) return false;
      return true;
    })
    .map((r) => ({
      id: r.id,
      pageUrl: r.pageUrl,
      fieldChanged: r.fieldChanged,
      beforeValue: (r.beforeState as { value?: string } | null)?.value ?? null,
      afterValue: (r.afterState as { value?: string } | null)?.value ?? "",
      status: r.status,
      cmsType: r.cmsConnectionId ? (connectionMap[r.cmsConnectionId] ?? "unknown") : "unknown",
      appliedAt: r.appliedAt?.toISOString() ?? null,
      rolledBackAt: r.rolledBackAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Change History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit log of all SEO changes pushed to your CMS.
        </p>
      </header>

      <ChangeHistoryLog
        items={items}
        page={pageNum}
        pageSize={PAGE_SIZE}
        cmsTypeFilter={cmsTypeFilter}
        statusFilter={statusFilter}
      />
    </div>
  );
}
