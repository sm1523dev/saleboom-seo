import type { Metadata } from "next";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, aiSuggestions, cmsConnections } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { ApprovalQueue } from "./_components/approval-queue";

export const metadata: Metadata = {
  title: "Approval Queue",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<{ page?: string }> };

export default async function ChangesPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  await getServerSession();

  const pending = await db
    .select({
      id: changeSnapshots.id,
      pageUrl: changeSnapshots.pageUrl,
      fieldChanged: changeSnapshots.fieldChanged,
      beforeState: changeSnapshots.beforeState,
      afterState: changeSnapshots.afterState,
      createdAt: changeSnapshots.createdAt,
      suggestionId: changeSnapshots.suggestionId,
      websiteId: aiSuggestions.websiteId,
    })
    .from(changeSnapshots)
    .leftJoin(aiSuggestions, eq(changeSnapshots.suggestionId, aiSuggestions.id))
    .where(and(eq(changeSnapshots.status, "pending"), isNull(changeSnapshots.deletedAt)))
    .orderBy(desc(changeSnapshots.createdAt))
    .limit(PAGE_SIZE)
    .offset((pageNum - 1) * PAGE_SIZE);

  // Fetch CMS connections for all unique websiteIds so we know which sites are connected
  const websiteIds = [...new Set(pending.map((r) => r.websiteId).filter(Boolean))] as string[];
  const connections = websiteIds.length > 0
    ? await db
        .select({ websiteId: cmsConnections.websiteId, cmsType: cmsConnections.cmsType, id: cmsConnections.id })
        .from(cmsConnections)
        .where(isNull(cmsConnections.deletedAt))
    : [];

  const connectedWebsites = new Set(connections.map((c) => c.websiteId));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approved AI suggestions waiting to be pushed to your CMS.
        </p>
      </header>

      <ApprovalQueue
        items={pending.map((r) => ({
          id: r.id,
          pageUrl: r.pageUrl,
          fieldChanged: r.fieldChanged,
          beforeValue: (r.beforeState as { value?: string } | null)?.value ?? null,
          afterValue: (r.afterState as { value?: string } | null)?.value ?? "",
          createdAt: r.createdAt.toISOString(),
          websiteId: r.websiteId ?? null,
          isCmsConnected: r.websiteId ? connectedWebsites.has(r.websiteId) : false,
        }))}
        page={pageNum}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
