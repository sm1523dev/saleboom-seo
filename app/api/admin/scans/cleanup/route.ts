import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST /api/admin/scans/cleanup
// Resets scans stuck in "running" (>10 min) or "pending" (>20 min) to "failed".
// Azure Functions have a hard 10-min execution limit — any "running" scan older than
// that is definitely orphaned. "pending" scans >20 min have a lost/poison-queued message.
export async function POST(): Promise<NextResponse> {
  const session = await authProvider.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [runningResult, pendingResult] = await Promise.all([
    db
      .update(scans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(scans.status, "running"),
          sql`${scans.updatedAt} < now() - interval '10 minutes'`
        )
      )
      .returning({ id: scans.id }),
    db
      .update(scans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(scans.status, "pending"),
          sql`${scans.updatedAt} < now() - interval '20 minutes'`
        )
      )
      .returning({ id: scans.id }),
  ]);

  const reset = runningResult.length + pendingResult.length;
  const scanIds = [
    ...runningResult.map((r) => r.id),
    ...pendingResult.map((r) => r.id),
  ];

  return NextResponse.json({ reset, scanIds, fromRunning: runningResult.length, fromPending: pendingResult.length });
}
