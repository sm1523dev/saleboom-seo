import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeSnapshots } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { rollbackChange } from "@/app/actions/changes.actions";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  try {
    await getServerSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [snapshot] = await db
    .select({ id: changeSnapshots.id })
    .from(changeSnapshots)
    .where(eq(changeSnapshots.id, id))
    .limit(1);

  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await rollbackChange(id);

  if (!result.success) {
    if (result.error === "already_rolled_back") {
      return NextResponse.json({ error: "Already rolled back" }, { status: 409 });
    }
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ success: true });
}
