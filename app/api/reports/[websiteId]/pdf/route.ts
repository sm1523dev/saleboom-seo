import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans, issues, dvsScores, aeoScores } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
import { computeSeoScore } from "@/lib/seo-score";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
): Promise<NextResponse> {
  const { websiteId } = await params;
  const session = await authProvider.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [site] = await db
    .select({ id: websites.id, name: websites.name, url: websites.url })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .limit(1);

  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [latestScan] = await db
    .select({ id: scans.id, completedAt: scans.completedAt })
    .from(scans)
    .where(and(eq(scans.websiteId, websiteId), eq(scans.status, "completed")))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  let seoScore = 0;
  let criticalCount = 0;
  let highCount = 0;
  let topIssues: Array<{ title: string; severity: string }> = [];

  if (latestScan) {
    const scanIssues = await db
      .select({ severity: issues.severity, title: issues.title, type: issues.type })
      .from(issues)
      .where(and(eq(issues.scanId, latestScan.id), isNull(issues.resolvedAt)))
      .limit(50);
    seoScore = computeSeoScore(scanIssues);
    criticalCount = scanIssues.filter((i) => i.severity === "critical").length;
    highCount = scanIssues.filter((i) => i.severity === "high").length;
    topIssues = scanIssues
      .filter((i) => i.severity === "critical" || i.severity === "high")
      .slice(0, 10)
      .map((i) => ({ title: i.title, severity: i.severity }));
  }

  const [latestDvs] = await db
    .select({ compositeScore: dvsScores.compositeScore })
    .from(dvsScores)
    .where(eq(dvsScores.websiteId, websiteId))
    .orderBy(desc(dvsScores.scoredAt))
    .limit(1);

  const [latestAeo] = await db
    .select({ compositeScore: aeoScores.compositeScore })
    .from(aeoScores)
    .where(eq(aeoScores.websiteId, websiteId))
    .orderBy(desc(aeoScores.scoredAt))
    .limit(1);

  const dvsScore = latestDvs ? Math.round(latestDvs.compositeScore) : null;
  const aeoScore = latestAeo ? Math.round(latestAeo.compositeScore) : null;
  const reportDate = new Date().toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const issueRows = topIssues
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(i.title)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;font-weight:600;color:${i.severity === "critical" ? "#dc2626" : "#d97706"}">${escapeHtml(i.severity)}</td>
        </tr>`
    )
    .join("");

  const safeName = escapeHtml(site.name);
  const safeUrl = escapeHtml(site.url);

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>${safeName} — SEO Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; background: #fff; padding: 40px; }
  h1 { font-size: 28px; font-weight: 700; color: #111; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
  .scores { display: flex; gap: 24px; margin-bottom: 32px; }
  .score-card { flex: 1; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; }
  .score-card .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .score-card .value { font-size: 40px; font-weight: 700; color: #7c3aed; }
  .score-card .sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }
  h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #374151; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  th { text-align: left; padding: 8px 12px; background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  @media print {
    body { padding: 0; }
    @page { margin: 24mm; size: A4; }
  }
</style>
<script>window.onload = function() { window.print(); };</script>
</head><body>
  <h1>${safeName}</h1>
  <p class="meta">${safeUrl} &middot; Report generated ${reportDate}</p>
  <div class="scores">
    <div class="score-card">
      <div class="label">DVS&trade; Score</div>
      <div class="value">${dvsScore ?? "&mdash;"}</div>
      <div class="sub">Digital Visibility Score</div>
    </div>
    <div class="score-card">
      <div class="label">SEO Score</div>
      <div class="value">${seoScore}</div>
      <div class="sub">${criticalCount} critical &middot; ${highCount} high</div>
    </div>
    <div class="score-card">
      <div class="label">AEO Score</div>
      <div class="value">${aeoScore ?? "&mdash;"}</div>
      <div class="sub">AI Engine Visibility</div>
    </div>
  </div>
  ${
    topIssues.length > 0
      ? `<h2>Top Priority Issues</h2>
  <table>
    <thead><tr><th>Issue</th><th>Severity</th></tr></thead>
    <tbody>${issueRows}</tbody>
  </table>`
      : ""
  }
  <div class="footer">Generated by SaleBoom SEO &middot; ${reportDate}</div>
</body></html>`;

  const filename = `${site.name.replace(/[^a-z0-9]/gi, "-")}-seo-report.pdf`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
