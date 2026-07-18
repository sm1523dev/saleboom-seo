import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, cmsConnections, websites } from "@/lib/db/schema";
import { loadCredentials } from "@/lib/cms/credentials";
import { persistDvsScore } from "@/lib/dvs/score";
import { logger } from "@/lib/logger";
import type { JobContext } from "@/lib/queue";

const PR_VERIFY_DELAY_MS = Number(process.env.GITHUB_PR_VERIFY_DELAY_MS ?? 120_000); // 2 min default

export async function handlePrPollJob(_data: unknown, _context: JobContext): Promise<void> {
  const log = logger.child({ component: "worker", job: "pr-poll" });

  // Find all snapshots with an open PR (pending + pr_number set)
  const openPrs = await db
    .select({
      id: changeSnapshots.id,
      prNumber: changeSnapshots.prNumber,
      pageUrl: changeSnapshots.pageUrl,
      fieldChanged: changeSnapshots.fieldChanged,
      afterState: changeSnapshots.afterState,
      cmsConnectionId: changeSnapshots.cmsConnectionId,
    })
    .from(changeSnapshots)
    .where(and(eq(changeSnapshots.status, "pending"), isNotNull(changeSnapshots.prNumber)));

  if (openPrs.length === 0) return;
  log.info("polling open PRs", { count: openPrs.length });

  for (const snapshot of openPrs) {
    try {
      await pollOne(snapshot, log);
    } catch (err) {
      log.warn("pr poll failed for snapshot", { snapshotId: snapshot.id, error: String(err) });
    }
  }
}

async function pollOne(
  snapshot: {
    id: string;
    prNumber: number | null;
    pageUrl: string;
    fieldChanged: string;
    afterState: unknown;
    cmsConnectionId: string | null;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: any,
): Promise<void> {
  if (!snapshot.prNumber || !snapshot.cmsConnectionId) return;

  // Resolve credentials via cmsConnection → website
  const [conn] = await db
    .select({ websiteId: cmsConnections.websiteId, credentialsRef: cmsConnections.credentialsRef })
    .from(cmsConnections)
    .where(eq(cmsConnections.id, snapshot.cmsConnectionId))
    .limit(1);

  if (!conn) return;

  const creds = await loadCredentials(conn.websiteId, "github");
  if (!creds) return;

  const { accessToken, repoOwner, repoName } = creds;

  const res = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${snapshot.prNumber}`,
    {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "SaleBoomSEO" },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    log.warn("GitHub API error fetching PR", { prNumber: snapshot.prNumber, status: res.status });
    return;
  }

  const pr = (await res.json()) as { state: string; merged: boolean; merge_commit_sha?: string };

  if (pr.state === "closed" && pr.merged) {
    await db
      .update(changeSnapshots)
      .set({
        status: "applied",
        mergeSha: pr.merge_commit_sha ?? null,
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(changeSnapshots.id, snapshot.id));

    void persistDvsScore(conn.websiteId).catch(() => undefined);
    log.info("PR merged → applied", { snapshotId: snapshot.id, prNumber: snapshot.prNumber });

    // Trigger post-merge verification after deployment delay
    if (PR_VERIFY_DELAY_MS > 0) {
      setTimeout(async () => {
        try {
          const { verifyLiveField } = await import("@/lib/cms/verify");
          const afterState = snapshot.afterState as { value?: string } | null;
          const expectedValue = afterState?.value ?? "";
          if (!expectedValue) return;
          const result = await verifyLiveField(snapshot.pageUrl, snapshot.fieldChanged as never, expectedValue);
          await db
            .update(changeSnapshots)
            .set({
              verifiedAt: new Date(),
              liveValue: result.liveValue,
              verifyError: result.matched ? null : result.error,
              updatedAt: new Date(),
            })
            .where(eq(changeSnapshots.id, snapshot.id));
        } catch { /* non-critical */ }
      }, PR_VERIFY_DELAY_MS);
    }

  } else if (pr.state === "closed" && !pr.merged) {
    await db
      .update(changeSnapshots)
      .set({ status: "rolled_back", rolledBackAt: new Date(), updatedAt: new Date() })
      .where(eq(changeSnapshots.id, snapshot.id));

    void persistDvsScore(conn.websiteId).catch(() => undefined);
    log.info("PR closed without merge → rolled_back", { snapshotId: snapshot.id });
  }
}
