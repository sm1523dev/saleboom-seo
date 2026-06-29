const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Email is required.");
  }
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function parseRequiredString(
  raw: FormDataEntryValue | null,
  fieldName: string
): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
  return raw.trim();
}
