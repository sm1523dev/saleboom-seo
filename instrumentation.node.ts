import { initTelemetry } from "./lib/telemetry/sdk";
import { runMigrations } from "./lib/db/migrate";

initTelemetry("saleboomseo");
await runMigrations();
