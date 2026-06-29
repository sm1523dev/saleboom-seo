import type { Logger, LogContext, AILogContext } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPino(base?: LogContext): any {
  const pino = require("pino");
  const level = process.env.LOG_LEVEL ?? "info";
  const dest = process.env.LOG_FILE
    ? pino.destination({ dest: process.env.LOG_FILE, append: true, sync: false })
    : undefined;
  const root = pino({ level }, dest);
  return base && Object.keys(base).length ? root.child(base) : root;
}

export class PinoLogger implements Logger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly p: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(pinoInstanceOrBase?: any) {
    this.p = pinoInstanceOrBase && typeof pinoInstanceOrBase.info === "function"
      ? pinoInstanceOrBase
      : buildPino(pinoInstanceOrBase);
  }

  debug(msg: string, ctx?: LogContext) { this.p.debug(ctx ?? {}, msg); }
  info(msg: string, ctx?: LogContext)  { this.p.info(ctx ?? {}, msg); }
  warn(msg: string, ctx?: LogContext)  { this.p.warn(ctx ?? {}, msg); }
  error(msg: string, ctx?: LogContext) { this.p.error(ctx ?? {}, msg); }

  ai(event: "call" | "error", ctx: AILogContext) {
    this.p[event === "error" ? "error" : "info"]({ ...ctx, component: "ai", event }, "ai." + event);
  }

  child(ctx: LogContext): Logger {
    return new PinoLogger(this.p.child(ctx));
  }
}
