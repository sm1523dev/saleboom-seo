import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots, cmsConnections } from "@/lib/db/schema";
import { loadCredentials } from "@/lib/cms/credentials";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ connectionId: string }> };

type PrPayload = {
  action: string;
  pull_request: {
    number: number;
    state: string;
    merged: boolean;
    merge_commit_sha: string | null;
  };
};

function verifySignature(rawBody: string, secret: string, sigHeader: string | null): boolean {
  if (!sigHeader?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { connectionId } = await params;

  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");

  // Only handle pull_request closed events
  if (event !== "pull_request") {
    return NextResponse.json({ ok: true, skipped: "not pull_request" });
  }

  // Load connection to get websiteId
  const [conn] = await db
    .select({ websiteId: cmsConnections.websiteId })
    .from(cmsConnections)
    .where(eq(cmsConnections.id, connectionId))
    .limit(1);

  if (!conn) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const creds = await loadCredentials(conn.websiteId, "github").catch(() => null);
  if (!creds?.webhookSecret) return NextResponse.json({ error: "no_secret" }, { status: 400 });

  if (!verifySignature(rawBody, creds.webhookSecret, sigHeader)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as PrPayload;

  // Only act on closed PRs
  if (body.action !== "closed") {
    return NextResponse.json({ ok: true, skipped: `action=${body.action}` });
  }

  const pr = body.pull_request;

  // Find the matching snapshot: pending, has this PR number, belongs to this connection
  const [snapshot] = await db
    .select({ id: changeSnapshots.id })
    .from(changeSnapshots)
    .where(
      and(
        eq(changeSnapshots.status, "pending"),
        eq(changeSnapshots.prNumber, pr.number),
        eq(changeSnapshots.cmsConnectionId, connectionId),
        isNotNull(changeSnapshots.prNumber),
      ),
    )
    .limit(1);

  if (!snapshot) {
    return NextResponse.json({ ok: true, skipped: "no_matching_snapshot" });
  }

  if (pr.merged) {
    await db
      .update(changeSnapshots)
      .set({
        status: "applied",
        mergeSha: pr.merge_commit_sha ?? null,
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(changeSnapshots.id, snapshot.id));
  } else {
    await db
      .update(changeSnapshots)
      .set({ status: "rolled_back", rolledBackAt: new Date(), updatedAt: new Date() })
      .where(eq(changeSnapshots.id, snapshot.id));
  }

  return NextResponse.json({ ok: true, snapshotId: snapshot.id, merged: pr.merged });
}
