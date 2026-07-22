import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ scanId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { scanId } = await params;

  const [row] = await db
    .select({
      status: scans.status,
      completedAt: scans.completedAt,
      pagesScanned: scans.pagesScanned,
      totalPages: scans.totalPages,
      platformHint: websites.platformHint,
    })
    .from(scans)
    .leftJoin(websites, eq(scans.websiteId, websites.id))
    .where(eq(scans.id, scanId))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    pagesScanned: row.pagesScanned ?? 0,
    totalPages: row.totalPages ?? 0,
    platformHint: row.platformHint ?? null,
  });
}
