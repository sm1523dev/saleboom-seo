import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { count } from "drizzle-orm";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT current_database() as db, now() as time`);
    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const [{ value: userCount }] = await db.select({ value: count() }).from(users);

    // Test a sign-up insert + rollback to verify the write path works
    let writeTest = "untested";
    try {
      await db.execute(sql`BEGIN`);
      await db.execute(sql`INSERT INTO users (email, password_hash) VALUES ('__ping_test__@test.com', 'x') ON CONFLICT DO NOTHING`);
      await db.execute(sql`ROLLBACK`);
      writeTest = "ok";
    } catch (e) {
      await db.execute(sql`ROLLBACK`).catch(() => {});
      writeTest = String(e);
    }

    return NextResponse.json({
      ok: true,
      db: result[0],
      tables: (tables as Array<Record<string, unknown>>).map((r) => r.table_name),
      userCount,
      writeTest,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
