"use server";

import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { providerRequests, users } from "@/lib/db/schema";
import { getServerSession, requireAdmin } from "@/lib/auth-utils";
import type { AuthSession } from "@/lib/auth";
import { majorFixHelpTemplate } from "@/lib/notifications/email-templates";
import { sendAdminAlert, sendTransactionalEmail } from "@/lib/notifications/send";
import { revalidatePath } from "next/cache";

function fireMajorFixAdminAlert(
  session: AuthSession,
  websiteUrl: string,
  issues: { issueTitle: string }[],
): void {
  if (issues.length === 0) return;
  const tpl = majorFixHelpTemplate({
    requesterName: session.user.name,
    requesterEmail: session.user.email,
    websiteUrl,
    issues: issues.map((i) => i.issueTitle),
  });
  const issueBullets = issues.map((i) => `• ${i.issueTitle}`).join("\n");
  const from = session.user.name ?? session.user.email;
  const slackText = `🔧 *Major fix help requested* (${issues.length})\nFrom: ${from} <${session.user.email}>\nSite: ${websiteUrl}\n\n${issueBullets}`;
  void sendAdminAlert({
    text: slackText,
    subject: tpl.subject,
    html: tpl.html,
  }).catch(() => {
    // Non-fatal — request row is already saved
  });
}

export async function requestMajorFixHelpBulk(issues: {
  issueId: string;
  issueTitle: string;
  websiteId: string;
  websiteUrl: string;
}[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (issues.length === 0) return { success: true, count: 0 };
  try {
    const session = await getServerSession();
    await db.insert(providerRequests).values(
      issues.map((d) => ({
        type: "major_fix" as const,
        providerName: d.issueTitle.slice(0, 100),
        reason: `User requested help with a major SEO fix on ${d.websiteUrl}`,
        requestedBy: session.user.id,
        issueId: d.issueId,
        websiteId: d.websiteId,
        status: "pending" as const,
      }))
    );
    fireMajorFixAdminAlert(session, issues[0].websiteUrl, issues);
    revalidatePath("/admin/requests");
    return { success: true, count: issues.length };
  } catch {
    return { success: false, count: 0, error: "Failed to submit requests" };
  }
}

export async function requestMajorFixHelp(data: {
  issueId: string;
  issueTitle: string;
  websiteId: string;
  websiteUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    await db.insert(providerRequests).values({
      type: "major_fix",
      providerName: data.issueTitle.slice(0, 100),
      reason: `User requested help with a major SEO fix on ${data.websiteUrl}`,
      requestedBy: session.user.id,
      issueId: data.issueId,
      websiteId: data.websiteId,
      status: "pending",
    });
    fireMajorFixAdminAlert(session, data.websiteUrl, [
      { issueTitle: data.issueTitle },
    ]);
    revalidatePath("/admin/requests");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to submit request" };
  }
}

export async function submitProviderRequest(data: {
  type: "ai" | "crawl" | "queue" | "storage" | "notifications";
  providerName: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    await db.insert(providerRequests).values({
      type: data.type,
      providerName: data.providerName.trim(),
      reason: data.reason.trim() || null,
      requestedBy: session.user.id,
      status: "pending",
    });
    revalidatePath("/admin/requests");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to submit request" };
  }
}

export async function forwardRequestToDeveloper(
  requestId: string,
  developerEmail: string,
  adminNote?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const [req] = await db
      .select({
        id: providerRequests.id,
        type: providerRequests.type,
        providerName: providerRequests.providerName,
        reason: providerRequests.reason,
        requesterName: users.name,
        requesterEmail: users.email,
        createdAt: providerRequests.createdAt,
      })
      .from(providerRequests)
      .innerJoin(users, eq(providerRequests.requestedBy, users.id))
      .where(eq(providerRequests.id, requestId))
      .limit(1);

    if (!req) return { success: false, error: "Request not found" };

    await sendTransactionalEmail({
      to: developerEmail.trim(),
      subject: `Provider Request: ${req.type} — ${req.providerName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#fafafa;padding:32px;border-radius:8px">
          <h2 style="color:#8b5cf6;margin-top:0">New Provider Request</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#71717a;width:140px">Adapter type</td><td style="padding:8px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${req.type}</td></tr>
            <tr><td style="padding:8px 0;color:#71717a">Provider name</td><td style="padding:8px 0;font-weight:600">${req.providerName}</td></tr>
            <tr><td style="padding:8px 0;color:#71717a">Requested by</td><td style="padding:8px 0">${req.requesterName ?? req.requesterEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#71717a">Date</td><td style="padding:8px 0">${new Date(req.createdAt).toDateString()}</td></tr>
            ${req.reason ? `<tr><td style="padding:8px 0;color:#71717a;vertical-align:top">Reason</td><td style="padding:8px 0">${req.reason}</td></tr>` : ""}
            ${adminNote ? `<tr><td style="padding:8px 0;color:#71717a;vertical-align:top">Admin note</td><td style="padding:8px 0">${adminNote}</td></tr>` : ""}
          </table>
          <p style="color:#71717a;font-size:12px;margin-top:24px">SaleBoom SEO — Provider Request System</p>
        </div>
      `,
      text: `Provider Request: ${req.type} - ${req.providerName}\nRequested by: ${req.requesterName ?? req.requesterEmail}\nReason: ${req.reason ?? "—"}\nAdmin note: ${adminNote ?? "—"}`,
    });

    await db
      .update(providerRequests)
      .set({ developerEmail: developerEmail.trim(), adminNote: adminNote ?? null, status: "in_progress", updatedAt: new Date() })
      .where(eq(providerRequests.id, requestId));

    revalidatePath("/admin/requests");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to forward request" };
  }
}

export async function updateRequestStatus(
  requestId: string,
  status: "in_progress" | "rejected" | "ready",
  adminNote?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db
      .update(providerRequests)
      .set({ status, adminNote: adminNote ?? null, updatedAt: new Date() })
      .where(eq(providerRequests.id, requestId));
    revalidatePath("/admin/requests");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update request" };
  }
}

export async function getProviderRequests() {
  await requireAdmin();
  return db
    .select({
      id: providerRequests.id,
      type: providerRequests.type,
      providerName: providerRequests.providerName,
      reason: providerRequests.reason,
      developerEmail: providerRequests.developerEmail,
      adminNote: providerRequests.adminNote,
      status: providerRequests.status,
      createdAt: providerRequests.createdAt,
      requesterName: users.name,
      requesterEmail: users.email,
    })
    .from(providerRequests)
    .innerJoin(users, eq(providerRequests.requestedBy, users.id))
    .where(isNull(providerRequests.deletedAt))
    .orderBy(providerRequests.createdAt);
}
