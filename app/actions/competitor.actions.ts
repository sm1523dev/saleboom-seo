"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, aeoProviders, aeoQueries, users } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { queryAeoProvider } from "@/lib/aeo/query-engine";
import { parseMention } from "@/lib/aeo/mention-parser";
import { sendTransactionalEmail } from "@/lib/notifications/send";
import { competitiveAnalysisTemplate } from "@/lib/notifications/email-templates";

export type CompetitorResult = {
  domain: string;
  mentionRate: number;
  mentionCount: number;
  totalQueries: number;
  providers: Array<{ name: string; mentioned: boolean }>;
};

export async function runCompetitorAnalysis(
  websiteId: string,
  competitorDomains: string[],
): Promise<{ own: CompetitorResult; competitors: CompetitorResult[] } | { error: string }> {
  const session = await getServerSession();

  const [site] = await db
    .select({ url: websites.url, name: websites.name })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .limit(1);

  if (!site) return { error: "Website not found" };

  const ownHostname = (() => {
    try {
      return new URL(site.url).hostname;
    } catch {
      return site.url;
    }
  })();

  const competitorHostnames = competitorDomains.slice(0, 3).map((d) => {
    try {
      return new URL(d.startsWith("http") ? d : `https://${d}`).hostname;
    } catch {
      return d;
    }
  }).filter(Boolean);

  const domains = [ownHostname, ...competitorHostnames];

  const queries = await db
    .select({ id: aeoQueries.id, promptText: aeoQueries.promptText })
    .from(aeoQueries)
    .where(and(eq(aeoQueries.websiteId, websiteId), eq(aeoQueries.active, true)))
    .limit(5);

  if (queries.length === 0) {
    return { error: "No AEO queries configured. Run an AEO scan first." };
  }

  const providers = await db
    .select()
    .from(aeoProviders)
    .where(eq(aeoProviders.enabled, true))
    .limit(3);

  if (providers.length === 0) {
    return { error: "No AEO providers enabled." };
  }

  const QUERY_TIMEOUT_MS = 25_000;

  const results: CompetitorResult[] = await Promise.all(
    domains.map(async (domain) => {
      const totalQueries = queries.length * providers.length;

      // Run all provider × query pairs in parallel so the whole domain
      // takes at most QUERY_TIMEOUT_MS regardless of pair count.
      type PairResult = { providerId: string; mentioned: boolean };
      const pairs: PairResult[] = await Promise.all(
        providers.flatMap((provider) =>
          queries.map(async (query): Promise<PairResult> => {
            try {
              const response = await Promise.race([
                queryAeoProvider(provider as import("@/lib/aeo/types").AeoProvider, query.promptText),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), QUERY_TIMEOUT_MS)),
              ]);
              const mention = parseMention(response.text, domain);
              return { providerId: provider.id, mentioned: mention.brandMentioned };
            } catch {
              return { providerId: provider.id, mentioned: false };
            }
          })
        )
      );

      const mentionCount = pairs.filter((p) => p.mentioned).length;

      const providerResults = providers.map((provider) => ({
        name: provider.displayName,
        mentioned: pairs.some((p) => p.providerId === provider.id && p.mentioned),
      }));

      return {
        domain,
        mentionRate: totalQueries > 0 ? mentionCount / totalQueries : 0,
        mentionCount,
        totalQueries,
        providers: providerResults,
      };
    })
  );

  const [own, ...competitors] = results;

  // Notify user — fire-and-forget, non-fatal
  void (async () => {
    try {
      const [userRow] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      if (!userRow || !own) return;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://saleboomseo.com";
      const tpl = competitiveAnalysisTemplate({
        userName: userRow.name,
        websiteName: site.name ?? site.url,
        websiteUrl: site.url,
        ownMentionRate: own.mentionRate,
        competitorCount: competitors.length,
        appUrl,
        websiteId,
      });
      await sendTransactionalEmail({ to: userRow.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {
      // Non-fatal
    }
  })();

  return { own, competitors };
}
