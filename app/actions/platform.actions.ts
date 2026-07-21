"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import type { Platform } from "@/lib/platform-detect";

export async function setPlatformHint(websiteId: string, platform: Platform): Promise<void> {
  await getServerSession();
  await db
    .update(websites)
    .set({ platformHint: platform, platformHintStatus: "unconfirmed", updatedAt: new Date() })
    .where(eq(websites.id, websiteId));
}

export async function confirmPlatform(websiteId: string, platform: Platform): Promise<void> {
  await getServerSession();
  await db
    .update(websites)
    .set({ platformHint: platform, platformHintStatus: "confirmed", updatedAt: new Date() })
    .where(eq(websites.id, websiteId));
}

export async function rejectDetectedPlatform(websiteId: string): Promise<void> {
  await getServerSession();
  // Track wrong detection, clear hint so user can pick the correct one
  await db
    .update(websites)
    .set({
      platformHint: null,
      platformHintStatus: "unconfirmed",
      wrongDetectionCount: sql`${websites.wrongDetectionCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(websites.id, websiteId));
}

export async function requestPlatformAssistance(websiteId: string): Promise<void> {
  await getServerSession();
  await db
    .update(websites)
    .set({ platformHintStatus: "pending_assistance", updatedAt: new Date() })
    .where(eq(websites.id, websiteId));
}
