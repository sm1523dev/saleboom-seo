"use server";

import { inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { issues, changeSnapshots } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { aiProvider } from "@/lib/ai";
import type { CmsField } from "@/lib/cms/types";

type IssueFix = {
  issueId: string;
  pageUrl: string;
  field: CmsField;
  beforeValue: string | null;
  afterValue: string;
};

// Maps issue types to the CMS field they fix and how to prompt the AI
const ISSUE_FIX_MAP: Record<string, { field: CmsField; buildPrompt: (issue: { title: string; description: string | null; pageUrl: string }) => string }> = {
  "meta-title-missing": { field: "meta_title", buildPrompt: (i) => `Write a concise, keyword-rich meta title (50-60 chars) for this page: ${i.pageUrl}. Issue: ${i.title}.` },
  "meta-title-too-short": { field: "meta_title", buildPrompt: (i) => `Expand this meta title to 50-60 chars for: ${i.pageUrl}. Issue: ${i.title}. ${i.description ?? ""}` },
  "meta-title-too-long": { field: "meta_title", buildPrompt: (i) => `Shorten this meta title to under 60 chars for: ${i.pageUrl}. Issue: ${i.title}. ${i.description ?? ""}` },
  "meta-description-missing": { field: "meta_description", buildPrompt: (i) => `Write a meta description (140-160 chars) for: ${i.pageUrl}. Issue: ${i.title}.` },
  "meta-description-too-short": { field: "meta_description", buildPrompt: (i) => `Expand this meta description to 140-160 chars for: ${i.pageUrl}. Issue: ${i.title}. ${i.description ?? ""}` },
  "meta-description-too-long": { field: "meta_description", buildPrompt: (i) => `Shorten this meta description to under 160 chars for: ${i.pageUrl}. Issue: ${i.title}. ${i.description ?? ""}` },
  "h1-missing": { field: "h1", buildPrompt: (i) => `Write a clear, keyword-focused H1 heading for: ${i.pageUrl}. Issue: ${i.title}.` },
  "h1-too-long": { field: "h1", buildPrompt: (i) => `Shorten this H1 to under 70 chars for: ${i.pageUrl}. Issue: ${i.title}. ${i.description ?? ""}` },
  "og-title-missing": { field: "meta_title", buildPrompt: (i) => `Write a social-share title (og:title, 50-60 chars) for: ${i.pageUrl}. Issue: ${i.title}.` },
  "og-description-missing": { field: "meta_description", buildPrompt: (i) => `Write a social-share description (og:description, 140-160 chars) for: ${i.pageUrl}. Issue: ${i.title}.` },
  "twitter-card-missing": { field: "meta_title", buildPrompt: (i) => `Write a Twitter card title for: ${i.pageUrl}. Issue: ${i.title}.` },
  "images-missing-alt": { field: "h1", buildPrompt: (i) => `Write a descriptive alt text for an image on this page: ${i.pageUrl}. Issue: ${i.title}. ${i.description ?? ""}` },
  "images-empty-alt": { field: "h1", buildPrompt: (i) => `Write a descriptive alt text for an image on this page: ${i.pageUrl}. Issue: ${i.title}. ${i.description ?? ""}` },
  "canonical-missing": { field: "meta_title", buildPrompt: (i) => `This page is missing a canonical URL tag. Write a unique, keyword-focused meta title (50-60 chars) for: ${i.pageUrl}.` },
  "duplicate-meta-title": { field: "meta_title", buildPrompt: (i) => `This page has a duplicate meta title shared with other pages. Write a UNIQUE, page-specific meta title (50-60 chars) for: ${i.pageUrl}. ${i.description ?? ""}` },
  "duplicate-meta-description": { field: "meta_description", buildPrompt: (i) => `This page has a duplicate meta description. Write a UNIQUE meta description (140-160 chars) for: ${i.pageUrl}. ${i.description ?? ""}` },
  "duplicate-h1": { field: "h1", buildPrompt: (i) => `This page has a duplicate H1 shared with other pages. Write a UNIQUE H1 heading for: ${i.pageUrl}. ${i.description ?? ""}` },
  "h1-title-identical-sitewide": { field: "h1", buildPrompt: (i) => `This page's H1 matches its meta title exactly. Write a distinct H1 (different from the meta title) for: ${i.pageUrl}.` },
  "h1-matches-title": { field: "h1", buildPrompt: (i) => `This page's H1 is identical to its meta title. Write a distinct, content-focused H1 heading for: ${i.pageUrl}. ${i.description ?? ""}` },
  "duplicate-og-title": { field: "meta_title", buildPrompt: (i) => `This page's Open Graph title is duplicated across pages. Write a UNIQUE og:title (50-60 chars) for: ${i.pageUrl}. ${i.description ?? ""}` },
};

export async function generateAndQueueIssueFixes(
  issueIds: string[],
): Promise<{ queued: number; failed: number }> {
  if (issueIds.length === 0) return { queued: 0, failed: 0 };
  const session = await getServerSession();
  const userId = session.user.id as string;

  const rows = await db
    .select()
    .from(issues)
    .where(inArray(issues.id, issueIds));

  const fixes: IssueFix[] = [];
  let failed = 0;

  const processIssue = async (issue: typeof rows[0]) => {
    if (!issue.pageUrl) { failed++; return; }
    const mapping = ISSUE_FIX_MAP[issue.type];
    if (!mapping) { failed++; return; }
    try {
      const prompt = mapping.buildPrompt({
        title: issue.title,
        description: issue.description,
        pageUrl: issue.pageUrl,
      });
      const result = await aiProvider.generateText(prompt, {
        system: "You are an SEO expert. Reply with ONLY the requested text value — no explanations, no quotes, no labels. Be direct and concise.",
        maxTokens: 2000,
      });
      const value = result.trim();
      if (!value) { failed++; return; }
      fixes.push({
        issueId: issue.id,
        pageUrl: issue.pageUrl,
        field: mapping.field,
        beforeValue: null,
        afterValue: value,
      });
    } catch {
      failed++;
    }
  };

  // Process in batches of 5 to avoid overwhelming the AI provider
  const BATCH = 5;
  for (let i = 0; i < rows.length; i += BATCH) {
    await Promise.allSettled(rows.slice(i, i + BATCH).map(processIssue));
  }

  if (fixes.length === 0) return { queued: 0, failed };

  await db.insert(changeSnapshots).values(
    fixes.map((f) => ({
      pageUrl: f.pageUrl,
      fieldChanged: f.field,
      beforeState: { value: f.beforeValue },
      afterState: { value: f.afterValue },
      issueId: f.issueId,
      userId,
      status: "pending" as const,
    })),
  ).onConflictDoNothing();

  // Mark issues as having a pending fix (resolvedAt stays null until CMS push)
  await db
    .update(issues)
    .set({ updatedAt: new Date() })
    .where(inArray(issues.id, fixes.map((f) => f.issueId)));

  return { queued: fixes.length, failed };
}
