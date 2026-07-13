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

type WpResourceType = "pages" | "posts" | "categories" | "tags";

type SeoPlugin = "yoast" | "rankmath" | "aioseo" | "none";

const PLUGIN_META: Record<SeoPlugin, { title: string | null; description: string | null }> = {
  yoast:    { title: "_yoast_wpseo_title",  description: "_yoast_wpseo_metadesc" },
  rankmath: { title: "rank_math_title",      description: "rank_math_description" },
  aioseo:   { title: "_aioseo_title",        description: "_aioseo_description" },
  none:     { title: null,                   description: null },
};

// Cache per siteUrl so we only probe once per process lifetime
const pluginCache = new Map<string, SeoPlugin>();

async function detectSeoPlugin(siteUrl: string, creds: WpCreds): Promise<SeoPlugin> {
  const cached = pluginCache.get(siteUrl);
  if (cached) return cached;

  for (const type of ["posts", "pages"] as const) {
    const res = await wpFetch(siteUrl, `/${type}?context=edit&per_page=1&_fields=meta`, creds);
    if (!res.ok) continue;
    const data = (await res.json()) as Array<{ meta?: Record<string, unknown> }>;
    const meta = data[0]?.meta;
    if (!meta) continue;
    const keys = Object.keys(meta);
    let plugin: SeoPlugin = "none";
    if (keys.some((k) => k.startsWith("_yoast_wpseo"))) plugin = "yoast";
    else if (keys.some((k) => k.startsWith("rank_math"))) plugin = "rankmath";
    else if (keys.some((k) => k.startsWith("_aioseo"))) plugin = "aioseo";
    pluginCache.set(siteUrl, plugin);
    return plugin;
  }

  pluginCache.set(siteUrl, "none");
  return "none";
}

async function resolveResource(
  siteUrl: string,
  pageUrl: string,
  creds: WpCreds,
): Promise<{ id: string; type: WpResourceType }> {
  let slug: string;
  let taxonomyHint: "categories" | "tags" | null = null;

  try {
    const parsed = new URL(pageUrl);
    const segments = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    slug = segments[segments.length - 1] ?? "";
    // Detect taxonomy archives by their URL prefix segments
    if (segments.includes("category")) taxonomyHint = "categories";
    else if (segments.includes("tag")) taxonomyHint = "tags";
  } catch {
    slug = pageUrl.replace(/\/$/, "").split("/").pop() ?? "";
  }

  // Check the hinted taxonomy type first so category/tag pages resolve correctly
  const orderedTypes: WpResourceType[] = taxonomyHint
    ? [taxonomyHint, "pages", "posts", "categories", "tags"]
    : ["pages", "posts", "categories", "tags"];

  for (const type of orderedTypes) {
    const res = await wpFetch(
      siteUrl,
      `/${type}?slug=${encodeURIComponent(slug)}&_fields=id&per_page=1`,
      creds,
    );
    if (!res.ok) continue;
    const data = (await res.json()) as Array<{ id: number }>;
    if (data.length > 0) return { id: String(data[0].id), type };
  }

  throw new CmsNotFoundError(pageUrl);
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
    const { id: pageId, type: resourceType } = await resolveResource(creds.siteUrl, payload.pageUrl, creds);
    const isTaxonomy = resourceType === "categories" || resourceType === "tags";

    const plugin = await detectSeoPlugin(creds.siteUrl, creds);
    const pluginFields = PLUGIN_META[plugin];

    const body: Record<string, unknown> = {};
    const pushedFields: CmsField[] = [];

    // H1 — native title field; skip for taxonomy archives (term name != page H1)
    if (payload.fields.h1 !== undefined && !isTaxonomy) {
      body.title = payload.fields.h1;
      pushedFields.push("h1");
    }

    // SEO meta — write to whichever plugin is active; fall back to native title when no plugin
    const meta: Record<string, string> = {};

    if (payload.fields.meta_title !== undefined) {
      if (pluginFields.title) {
        meta[pluginFields.title] = payload.fields.meta_title;
        pushedFields.push("meta_title");
      } else if (!isTaxonomy) {
        // No SEO plugin — native title is the only option (changes H1 too)
        body.title = payload.fields.meta_title;
        pushedFields.push("meta_title");
      }
    }

    if (payload.fields.meta_description !== undefined && pluginFields.description) {
      meta[pluginFields.description] = payload.fields.meta_description;
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
