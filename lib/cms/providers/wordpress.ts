import type { CmsAdapter, CmsCredentials, PushPayload, PushResult, ValidationResult } from "../types";
import { CmsAuthError, CmsNotFoundError } from "../types";
import type { CmsField } from "../types";

type WpCreds = CmsCredentials["wordpress"];

function basicAuth(username: string, password: string): string {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

function normaliseUrl(raw: string): string {
  const url = raw.trim().replace(/\/$/, "");
  return url.startsWith("http") ? url : `https://${url}`;
}

async function wpFetch(
  siteUrl: string,
  path: string,
  creds: WpCreds,
  options: RequestInit = {},
): Promise<Response> {
  const base = normaliseUrl(siteUrl);
  // path must start with /wp/v2/ or /wp/ — prefix it automatically if not already
  const apiPath = path.startsWith("/wp/") ? path : `/wp/v2${path}`;
  const res = await fetch(`${base}/wp-json${apiPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(creds.username, creds.applicationPassword),
      ...options.headers,
    },
  });
  if (res.status === 401 || res.status === 403) throw new CmsAuthError("Invalid credentials");
  return res;
}

async function resolvePageId(siteUrl: string, pageUrl: string, creds: WpCreds): Promise<string> {
  const base = normaliseUrl(siteUrl);
  // Extract path from the page URL and derive slug from the last segment
  let slug: string;
  try {
    const parsed = new URL(pageUrl);
    const segments = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    slug = segments[segments.length - 1] ?? "";
  } catch {
    slug = pageUrl.replace(/\/$/, "").split("/").pop() ?? "";
  }

  // Try pages first, then posts
  for (const type of ["pages", "posts"] as const) {
    const res = await wpFetch(
      siteUrl,
      `/${type}?slug=${encodeURIComponent(slug)}&_fields=id,link&per_page=1`,
      creds,
    );
    if (!res.ok) continue;
    const data = (await res.json()) as Array<{ id: number; link: string }>;
    if (data.length > 0) return String(data[0].id);
  }

  // Last resort: search by link header
  const res = await wpFetch(siteUrl, `/search?search=${encodeURIComponent(base)}&per_page=1`, creds);
  if (res.ok) {
    const data = (await res.json()) as Array<{ id: number }>;
    if (data.length > 0) return String(data[0].id);
  }

  throw new CmsNotFoundError(pageUrl);
}

async function determineResourceType(
  siteUrl: string,
  pageId: string,
  creds: WpCreds,
): Promise<"pages" | "posts"> {
  const pagesRes = await wpFetch(siteUrl, `/pages/${pageId}?_fields=id`, creds);
  if (pagesRes.ok) return "pages";
  return "posts";
}

export class WordPressAdapter implements CmsAdapter<"wordpress"> {
  async validate(creds: WpCreds): Promise<ValidationResult> {
    try {
      const res = await wpFetch(creds.siteUrl, "/users/me?_fields=slug", creds);
      if (!res.ok) return { valid: false, error: `WordPress returned ${res.status}` };
      const user = (await res.json()) as { slug?: string };
      return { valid: true, userLogin: user.slug ?? creds.username };
    } catch (err) {
      if (err instanceof CmsAuthError) return { valid: false, error: "Authentication failed — check your application password" };
      return { valid: false, error: "Could not reach the WordPress site" };
    }
  }

  async push(payload: PushPayload, creds: WpCreds): Promise<PushResult> {
    const pageId = await resolvePageId(creds.siteUrl, payload.pageUrl, creds);
    const resourceType = await determineResourceType(creds.siteUrl, pageId, creds);

    const body: Record<string, unknown> = {};
    const pushedFields: CmsField[] = [];

    if (payload.fields.h1 !== undefined) {
      body.title = payload.fields.h1;
      pushedFields.push("h1");
    }

    // Yoast SEO meta fields (most common SEO plugin)
    const meta: Record<string, string> = {};
    if (payload.fields.meta_title !== undefined) {
      meta._yoast_wpseo_title = payload.fields.meta_title;
      pushedFields.push("meta_title");
    }
    if (payload.fields.meta_description !== undefined) {
      meta._yoast_wpseo_metadesc = payload.fields.meta_description;
      pushedFields.push("meta_description");
    }
    if (Object.keys(meta).length > 0) body.meta = meta;

    if (Object.keys(body).length === 0) return { success: true, pageId, pushedFields: [] };

    const res = await wpFetch(creds.siteUrl, `/${resourceType}/${pageId}`, creds, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (res.status === 404) throw new CmsNotFoundError(payload.pageUrl);
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? `WordPress push failed: ${res.status}`);
    }

    return { success: true, pageId, pushedFields };
  }
}
