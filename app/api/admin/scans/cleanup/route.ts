import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST /api/admin/scans/cleanup
// Resets scans stuck in "running" for longer than the given threshold (default 15 min).
// Used to recover from Azure Function timeouts where the catch block never fired.
export async function POST(): Promise<NextResponse> {
  const session = await authProvider.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await db
    .update(scans)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(
        eq(scans.status, "running"),
        sql`${scans.updatedAt} < now() - interval '15 minutes'`
      )
    )
    .returning({ id: scans.id });

  return NextResponse.json({ reset: result.length, scanIds: result.map((r) => r.id) });
}
