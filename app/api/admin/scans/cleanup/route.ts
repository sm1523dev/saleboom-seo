import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST /api/admin/scans/cleanup
// Resets scans stuck in "running" (>15 min) or "pending" (>30 min) to "failed".
// "pending" scans >30 min have their queue message in the poison queue or lost entirely —
// they will never be processed and must be failed so users can re-trigger the scan.
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
          sql`${scans.updatedAt} < now() - interval '15 minutes'`
        )
      )
      .returning({ id: scans.id }),
    db
      .update(scans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(scans.status, "pending"),
          sql`${scans.updatedAt} < now() - interval '30 minutes'`
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
