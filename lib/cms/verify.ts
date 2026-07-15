import type { CmsField } from "./types";

export type VerifyResult =
  | { matched: true;  liveValue: string; error: null }
  | { matched: false; liveValue: string | null; error: VerifyError };

export type VerifyError =
  | "fetch_timeout"        // site unreachable within 8s
  | "fetch_failed"         // HTTP error (4xx/5xx)
  | "field_not_found"      // field not present in the HTML at all
  | "cached_old_value"     // live page still shows the BEFORE value — WP cache
  | "value_mismatch";      // field found, but neither value contains the other

function extractField(html: string, field: CmsField): string | null {
  if (field === "meta_title") {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return m?.[1]?.trim() ?? null;
  }
  if (field === "meta_description") {
    const a = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
    const b = html.match(/<meta[^>]*content=["']([^"']*)"[^>]*name=["']description["']/i);
    return (a ?? b)?.[1]?.trim() ?? null;
  }
  if (field === "h1") {
    const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return m?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
  }
  return null;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function contains(haystack: string, needle: string): boolean {
  return normalise(haystack).includes(normalise(needle));
}

export async function verifyLiveField(
  pageUrl: string,
  field: CmsField,
  expectedValue: string,
  beforeValue?: string | null,
): Promise<VerifyResult> {
  let html: string;
  try {
    const res = await fetch(pageUrl, {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { matched: false, liveValue: null, error: "fetch_failed" };
    }
    html = await res.text();
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { matched: false, liveValue: null, error: isTimeout ? "fetch_timeout" : "fetch_failed" };
  }

  const liveValue = extractField(html, field);

  if (!liveValue) {
    return { matched: false, liveValue: null, error: "field_not_found" };
  }

  // Soft match: pushed value is substring of live (Yoast appends " – Site Name"),
  // or live is substring of pushed (rare but handles stripped site-name cases).
  if (contains(liveValue, expectedValue) || contains(expectedValue, liveValue)) {
    return { matched: true, liveValue, error: null };
  }

  // Diagnose WHY it didn't match:
  // If the live value still shows the BEFORE value, it's a WP cache hit.
  if (beforeValue && (contains(liveValue, beforeValue) || contains(beforeValue, liveValue))) {
    return { matched: false, liveValue, error: "cached_old_value" };
  }

  return { matched: false, liveValue, error: "value_mismatch" };
}

// Human-readable labels for display in the UI.
export const VERIFY_ERROR_LABELS: Record<VerifyError, string> = {
  fetch_timeout:    "Site unreachable (timeout)",
  fetch_failed:     "Could not fetch live page",
  field_not_found:  "Field not found in HTML",
  cached_old_value: "Old value still showing — WordPress cache",
  value_mismatch:   "Live value differs",
};
