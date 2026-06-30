import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, aiReferrals } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  // Always return 200 — never reveal internals to the client snippet
  const ok = NextResponse.json({ ok: true }, { status: 200 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return ok;

    const { websiteId, referrerPlatform, landingPath, sessionId } = body as Record<string, unknown>;

    if (
      typeof websiteId !== "string" || !UUID_RE.test(websiteId) ||
      typeof sessionId !== "string" || !UUID_RE.test(sessionId) ||
      typeof referrerPlatform !== "string" ||
      typeof landingPath !== "string"
    ) return ok;

    // Verify websiteId exists
    const [site] = await db
      .select({ id: websites.id })
      .from(websites)
      .where(eq(websites.id, websiteId))
      .limit(1);
    if (!site) return ok;

    // Deduplicate: skip if session already recorded for this website
    const [existing] = await db
      .select({ id: aiReferrals.id })
      .from(aiReferrals)
      .where(and(eq(aiReferrals.websiteId, websiteId), eq(aiReferrals.sessionId, sessionId)))
      .limit(1);
    if (existing) return ok;

    await db.insert(aiReferrals).values({
      websiteId,
      visitedAt: new Date(),
      referrerPlatform: referrerPlatform.slice(0, 60),
      landingPath: landingPath.slice(0, 500),
      sessionId,
    });
  } catch (err) {
    logger.warn("aeo referral insert failed", { error: String(err) });
  }

  return ok;
}
