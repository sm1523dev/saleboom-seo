import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

export async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("[migrate] Checking for pending migrations...");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("[migrate] Done.");

  await client.end();
}

// Allow running directly: tsx lib/db/migrate.ts
if (process.argv[1] === import.meta.filename) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
