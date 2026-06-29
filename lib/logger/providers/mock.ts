import type { Logger, LogContext, AILogContext } from "../types";

export class MockLogger implements Logger {
  debug() {}
  info() {}
  warn() {}
  error() {}
  ai(_event: "call" | "error", _ctx: AILogContext) {}
  child(_ctx: LogContext): Logger { return this; }
}
