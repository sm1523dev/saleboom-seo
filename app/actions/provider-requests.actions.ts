"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { providerRequests, users } from "@/lib/db/schema";
import { getServerSession, requireAdmin } from "@/lib/auth-utils";
import { getNotificationProvider } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

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

    const provider = await getNotificationProvider();
    await provider.sendEmail({
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
