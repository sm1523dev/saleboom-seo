import type { Logger, LogContext, AILogContext } from "../types";

const COLORS = {
  debug: "\x1b[37m",  // white
  info:  "\x1b[36m",  // cyan
  warn:  "\x1b[33m",  // yellow
  error: "\x1b[31m",  // red
  ai:    "\x1b[35m",  // magenta
  reset: "\x1b[0m",
};

function fmt(level: string, msg: string, ctx?: LogContext): void {
  const color = COLORS[level as keyof typeof COLORS] ?? COLORS.reset;
  const ts = new Date().toISOString();
  const ctxStr = ctx && Object.keys(ctx).length ? " " + JSON.stringify(ctx) : "";
  console.log(`${color}[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}${ctxStr}${COLORS.reset}`);
}

export class ConsoleLogger implements Logger {
  constructor(private readonly base: LogContext = {}) {}

  debug(msg: string, ctx?: LogContext) { fmt("debug", msg, { ...this.base, ...ctx }); }
  info(msg: string, ctx?: LogContext)  { fmt("info",  msg, { ...this.base, ...ctx }); }
  warn(msg: string, ctx?: LogContext)  { fmt("warn",  msg, { ...this.base, ...ctx }); }
  error(msg: string, ctx?: LogContext) { fmt("error", msg, { ...this.base, ...ctx }); }

  ai(event: "call" | "error", ctx: AILogContext) {
    const color = event === "error" ? COLORS.error : COLORS.ai;
    const ts = new Date().toISOString();
    console.log(
      `${color}[${ts}] AI    ${event.toUpperCase()} model=${ctx.model} latency=${ctx.latencyMs}ms` +
      (ctx.promptTokens ? ` tokens=${ctx.promptTokens}+${ctx.completionTokens}` : "") +
      (ctx.scanId ? ` scanId=${ctx.scanId}` : "") +
      COLORS.reset
    );
  }

  child(ctx: LogContext): Logger {
    return new ConsoleLogger({ ...this.base, ...ctx });
  }
}
