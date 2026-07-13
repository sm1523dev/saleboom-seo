"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, aeoProviders, aeoQueries } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { queryAeoProvider } from "@/lib/aeo/query-engine";
import { parseMention } from "@/lib/aeo/mention-parser";

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

  const QUERY_TIMEOUT_MS = 30_000;

  const results: CompetitorResult[] = await Promise.all(
    domains.map(async (domain) => {
      let mentionCount = 0;
      const totalQueries = queries.length * providers.length;
      const providerResults: Array<{ name: string; mentioned: boolean }> = [];

      for (const provider of providers) {
        let providerMentions = 0;
        for (const query of queries) {
          try {
            const response = await Promise.race([
              queryAeoProvider(provider as import("@/lib/aeo/types").AeoProvider, query.promptText),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error("provider timeout")), QUERY_TIMEOUT_MS)),
            ]);
            const mention = parseMention(response.text, domain);
            if (mention.brandMentioned) {
              mentionCount++;
              providerMentions++;
            }
          } catch {
            // skip failed / timed-out queries
          }
        }
        providerResults.push({
          name: provider.displayName,
          mentioned: providerMentions > 0,
        });
      }

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
  return { own, competitors };
}
