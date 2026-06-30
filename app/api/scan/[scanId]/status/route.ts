import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ scanId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { scanId } = await params;

  const [scan] = await db
    .select({ status: scans.status, completedAt: scans.completedAt })
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    status: scan.status,
    completedAt: scan.completedAt?.toISOString() ?? null,
  });
}
