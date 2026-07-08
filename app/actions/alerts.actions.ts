"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAlerts } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function markAlertRead(alertId: string): Promise<void> {
  const session = await getServerSession();
  await db
    .update(userAlerts)
    .set({ readAt: new Date() })
    .where(and(eq(userAlerts.id, alertId), eq(userAlerts.userId, session.user.id)));
  revalidatePath("/alerts");
}

export async function markAllAlertsRead(): Promise<void> {
  const session = await getServerSession();
  await db
    .update(userAlerts)
    .set({ readAt: new Date() })
    .where(and(eq(userAlerts.userId, session.user.id), isNull(userAlerts.readAt)));
  revalidatePath("/alerts");
}
