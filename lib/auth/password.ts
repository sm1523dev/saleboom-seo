import bcrypt from "bcryptjs";

function getPepper(): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) throw new Error("PASSWORD_PEPPER env var is not set");
  return pepper;
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext + getPepper(), 12);
}

export async function verifyPassword(
  plaintext: string,
  storedHash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext + getPepper(), storedHash);
}
