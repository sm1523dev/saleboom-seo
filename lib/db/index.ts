import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const useSSL =
  connectionString.includes(".azure.com") ||
  connectionString.includes("sslmode=require");

const client = postgres(connectionString, {
  max: 1,
  ...(useSSL && { ssl: "require" }),
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
