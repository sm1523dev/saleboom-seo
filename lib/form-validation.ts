const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

export function parseWebsiteUrl(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("URL is required.");
  const trimmed = raw.trim();
  // Prepend https:// if no scheme provided
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid website URL (e.g. https://example.com).");
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new Error("URL must use http:// or https://.");
  }
  if (!parsed.hostname || parsed.hostname === "localhost") {
    throw new Error("Enter a public website URL, not localhost.");
  }
  return parsed.href;
}

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
