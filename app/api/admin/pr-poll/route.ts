import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, cmsConnections } from "@/lib/db/schema";
import { loadCredentials } from "@/lib/cms/credentials";
import { authProvider } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/admin/pr-poll
// Manually triggers one PR poll cycle and returns per-snapshot results.
// Used to diagnose why the pr-poll timer isn't updating snapshot statuses.
export async function POST(): Promise<NextResponse> {
  const session = await authProvider.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const openPrs = await db
    .select({
      id: changeSnapshots.id,
      prNumber: changeSnapshots.prNumber,
      prUrl: changeSnapshots.prUrl,
      cmsConnectionId: changeSnapshots.cmsConnectionId,
    })
    .from(changeSnapshots)
    .where(and(eq(changeSnapshots.status, "pending"), isNotNull(changeSnapshots.prNumber)));

  const results: Array<{ id: string; prNumber: number | null; outcome: string; detail?: string }> = [];

  for (const snapshot of openPrs) {
    if (!snapshot.prNumber || !snapshot.cmsConnectionId) {
      results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: "skip:no-pr-number-or-connection" });
      continue;
    }

    const [conn] = await db
      .select({ websiteId: cmsConnections.websiteId })
      .from(cmsConnections)
      .where(eq(cmsConnections.id, snapshot.cmsConnectionId))
      .limit(1);

    if (!conn) {
      results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: "skip:no-connection-row" });
      continue;
    }

    const creds = await loadCredentials(conn.websiteId, "github");
    if (!creds) {
      results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: "skip:no-credentials", detail: `websiteId=${conn.websiteId}` });
      continue;
    }

    const { accessToken, repoOwner, repoName } = creds;

    const res = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${snapshot.prNumber}`,
      {
        headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "SaleBoomSEO" },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: `github-error:${res.status}`, detail: `${repoOwner}/${repoName}` });
      continue;
    }

    const pr = (await res.json()) as { state: string; merged: boolean; merge_commit_sha?: string };

    if (pr.state === "open") {
      results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: "still-open", detail: `${repoOwner}/${repoName}` });
      continue;
    }

    if (pr.state === "closed" && pr.merged) {
      await db
        .update(changeSnapshots)
        .set({ status: "applied", mergeSha: pr.merge_commit_sha ?? null, appliedAt: new Date(), updatedAt: new Date() })
        .where(eq(changeSnapshots.id, snapshot.id));
      results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: "merged→applied", detail: `${repoOwner}/${repoName}` });
      continue;
    }

    if (pr.state === "closed" && !pr.merged) {
      await db
        .update(changeSnapshots)
        .set({ status: "rolled_back", rolledBackAt: new Date(), updatedAt: new Date() })
        .where(eq(changeSnapshots.id, snapshot.id));
      results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: "closed-not-merged→rolled_back", detail: `${repoOwner}/${repoName}` });
      continue;
    }

    results.push({ id: snapshot.id, prNumber: snapshot.prNumber, outcome: `unknown:state=${pr.state}` });
  }

  return NextResponse.json({ checked: openPrs.length, results });
}
