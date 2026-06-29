import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type ServiceStatus = "ok" | "error";

interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
  services: {
    database: ServiceStatus;
    queue: ServiceStatus;
  };
  details?: Record<string, string>;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const version = process.env.npm_package_version ?? "0.1.0";
  const timestamp = new Date().toISOString();
  const details: Record<string, string> = {};

  // Check database
  let dbStatus: ServiceStatus = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    dbStatus = "error";
    details.database = String(err);
  }

  // Check queue (Redis via BullMQ ping)
  let queueStatus: ServiceStatus = "ok";
  try {
    const provider = process.env.QUEUE_PROVIDER ?? "mock";
    if (provider === "bullmq") {
      const IORedis = require("ioredis");
      const url = process.env.REDIS_URL ?? "redis://localhost:6379";
      const redis = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
      await redis.ping();
      await redis.quit();
    }
  } catch (err) {
    queueStatus = "error";
    details.queue = String(err);
  }

  const allOk = dbStatus === "ok" && queueStatus === "ok";
  const body: HealthResponse = {
    status: allOk ? "ok" : "degraded",
    version,
    timestamp,
    services: { database: dbStatus, queue: queueStatus },
    ...(Object.keys(details).length ? { details } : {}),
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
