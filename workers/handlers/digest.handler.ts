import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, websites, scans, issues, dvsScores } from "@/lib/db/schema";
import { getNotificationProvider } from "@/lib/notifications";
import { digestTemplate } from "@/lib/notifications/email-templates";
import { logger } from "@/lib/logger";
import type { JobContext } from "@/lib/queue";

export async function handleDigestJob(
  _data: Record<string, unknown>,
  context: JobContext,
): Promise<void> {
  const log = logger.child({ component: "digest-worker" });
  log.info("weekly digest started");

  // All active users who have at least one website
  const activeUsers = await db
    .selectDistinct({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .innerJoin(websites, and(eq(websites.userId, users.id), isNull(websites.deletedAt)))
    .where(isNull(users.deletedAt));

  context.log(`sending digest to ${activeUsers.length} users`);

  for (const user of activeUsers) {
    try {
      const userWebsites = await db
        .select({ id: websites.id, name: websites.name, url: websites.url })
        .from(websites)
        .where(and(eq(websites.userId, user.id), isNull(websites.deletedAt)));

      const websiteDigests = await Promise.all(
        userWebsites.map(async (site) => {
          // Latest DVS score
          const [latest] = await db
            .select({ compositeScore: dvsScores.compositeScore })
            .from(dvsScores)
            .where(eq(dvsScores.websiteId, site.id))
            .orderBy(desc(dvsScores.scoredAt))
            .limit(1);

          // DVS score from the previous entry for delta calculation
          const [prev] = await db
            .select({ compositeScore: dvsScores.compositeScore })
            .from(dvsScores)
            .where(eq(dvsScores.websiteId, site.id))
            .orderBy(desc(dvsScores.scoredAt))
            .offset(1)
            .limit(1);

          // Most recent completed scan
          const [latestScan] = await db
            .select({ id: scans.id })
            .from(scans)
            .where(and(eq(scans.websiteId, site.id), eq(scans.status, "completed")))
            .orderBy(desc(scans.completedAt))
            .limit(1);

          let openIssues = 0;
          let topActions: string[] = [];
          if (latestScan) {
            const scanIssues = await db
              .select({ type: issues.type, severity: issues.severity, title: issues.title })
              .from(issues)
              .where(and(eq(issues.scanId, latestScan.id), isNull(issues.resolvedAt)))
              .limit(20);
            openIssues = scanIssues.length;
            topActions = scanIssues
              .filter((i) => i.severity === "critical" || i.severity === "high")
              .slice(0, 3)
              .map((i) => i.title);
          }

          const dvsScore = latest ? Math.round(latest.compositeScore) : null;
          const dvsDelta =
            latest && prev
              ? Math.round(latest.compositeScore - prev.compositeScore)
              : null;

          return { name: site.name, url: site.url, dvsScore, dvsDelta, openIssues, topActions };
        }),
      );

      const tmpl = digestTemplate({ userName: user.name ?? user.email, websites: websiteDigests });
      await (await getNotificationProvider()).sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
    } catch (err) {
      log.error("digest failed for user", { userId: user.id, error: String(err) });
    }
  }

  log.info("weekly digest complete");
}
