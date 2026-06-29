export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export interface AILogContext {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  scanId?: string;
  prompt?: string;
  response?: string;
}

export interface Logger {
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
  /** Structured log for AI provider calls — enables auditing of AI output quality. */
  ai(event: "call" | "error", ctx: AILogContext): void;
  child(ctx: LogContext): Logger;
}
