import type { Logger } from "./types";

function createLogger(): Logger {
  const provider = process.env.LOG_PROVIDER ?? "console";
  switch (provider) {
    case "pino":
      return new (require("./providers/pino").PinoLogger)();
    case "mock":
      return new (require("./providers/mock").MockLogger)();
    case "console":
    default:
      return new (require("./providers/console").ConsoleLogger)();
  }
}

export const logger: Logger = createLogger();
export type { Logger, LogLevel, LogContext, AILogContext } from "./types";
