import type { Metadata } from "next";
import Link from "next/link";
import { eq, and, isNull, inArray, gte, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, aeoProviders, aeoMentions, aeoCitations, aiReferrals, aeoScores } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { AeoDashboard } from "./_components/aeo-dashboard";

export const metadata: Metadata = {
  title: "AEO — AI Visibility",
  description: "Track how AI tools mention and cite your brand.",
  robots: { index: false, follow: false },
};

export default async function AeoPage() {
  const session = await getServerSession();

  const userWebsites = await db
    .select({ id: websites.id, name: websites.name, url: websites.url })
    .from(websites)
    .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)));

  const websiteIds = userWebsites.map((w) => w.id);

  if (websiteIds.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">AI Visibility</h1>
        </header>
        <div className="card-glow rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No websites connected yet.{" "}
            <Link href="/scan" className="text-primary hover:underline">
              Run a scan first →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  // Signal 1: per-provider mention stats
  const providers = await db
    .select({ id: aeoProviders.id, displayName: aeoProviders.displayName, model: aeoProviders.model })
    .from(aeoProviders)
    .where(inArray(aeoProviders.websiteId, websiteIds));

  const providerIds = providers.map((p) => p.id);

  const mentionStats =
    providerIds.length > 0
      ? await db
          .select({
            providerId: aeoMentions.providerId,
            total: sql<number>`count(*)::int`,
            mentioned: sql<number>`count(*) filter (where ${aeoMentions.brandMentioned})::int`,
          })
          .from(aeoMentions)
          .where(and(inArray(aeoMentions.providerId, providerIds), gte(aeoMentions.scanDate, cutoff)))
          .groupBy(aeoMentions.providerId)
      : [];

  // Signal 2: referral traffic from AI platforms
  const referralStats =
    websiteIds.length > 0
      ? await db
          .select({
            platform: aiReferrals.referrerPlatform,
            count: sql<number>`count(*)::int`,
          })
          .from(aiReferrals)
          .where(and(inArray(aiReferrals.websiteId, websiteIds), gte(aiReferrals.visitedAt, thirtyDaysAgo)))
          .groupBy(aiReferrals.referrerPlatform)
          .orderBy(desc(sql`count(*)`))
      : [];

  // Signal 3: recent own-domain citations
  const recentCitations =
    providerIds.length > 0
      ? await db
          .select({
            citedUrl: aeoCitations.citedUrl,
            providerId: aeoCitations.providerId,
            scanDate: aeoCitations.scanDate,
          })
          .from(aeoCitations)
          .where(
            and(
              inArray(aeoCitations.providerId, providerIds),
              gte(aeoCitations.scanDate, cutoff),
              eq(aeoCitations.isOwnDomain, true),
            )
          )
          .orderBy(desc(aeoCitations.scanDate))
          .limit(20)
      : [];

  // Latest composite score per website
  const latestScore =
    websiteIds.length > 0
      ? await db
          .select({
            compositeScore: aeoScores.compositeScore,
            scoredAt: aeoScores.scoredAt,
          })
          .from(aeoScores)
          .where(inArray(aeoScores.websiteId, websiteIds))
          .orderBy(desc(aeoScores.scoredAt))
          .limit(1)
      : [];

  return (
    <AeoDashboard
      providers={providers}
      mentionStats={mentionStats}
      referralStats={referralStats}
      recentCitations={recentCitations.map((c) => ({
        ...c,
        scanDate: typeof c.scanDate === "string" ? c.scanDate : c.scanDate,
        providerName: providers.find((p) => p.id === c.providerId)?.displayName ?? "Unknown",
      }))}
      compositeScore={latestScore[0]?.compositeScore ?? null}
      scoredAt={latestScore[0]?.scoredAt?.toISOString() ?? null}
    />
  );
}
