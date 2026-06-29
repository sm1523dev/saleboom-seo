import { createHmac, randomBytes } from "crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

type ResetPayload = {
  sub: string; // userId
  exp: number;
  nonce: string;
};

export function createResetToken(userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env var is not set");

  const payload: ResetPayload = {
    sub: userId,
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: randomBytes(8).toString("hex"),
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyResetToken(token: string): VerifyResult {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env var is not set");

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "invalid" };

  const [data, sig] = parts;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");

  // Constant-time comparison to prevent timing attacks
  if (sig.length !== expected.length) return { ok: false, reason: "invalid" };
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return { ok: false, reason: "invalid" };

  let payload: ResetPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (Date.now() > payload.exp) return { ok: false, reason: "expired" };
  return { ok: true, userId: payload.sub };
}
