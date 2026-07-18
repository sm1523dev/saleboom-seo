import type { CmsCredentials, CmsType, GitHubFramework } from "./types";

export type CmsCapabilities = {
  meta_title: boolean;
  meta_description: boolean;
  h1: boolean;
  probeAt: string;
};

type SeoPlugin = "yoast" | "rankmath" | "aioseo" | "none";

async function detectWordPressPlugin(creds: CmsCredentials["wordpress"]): Promise<SeoPlugin> {
  const base = creds.siteUrl.trim().replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${creds.username}:${creds.applicationPassword}`).toString("base64");
  for (const type of ["posts", "pages"] as const) {
    try {
      const res = await fetch(`${base}/wp-json/wp/v2/${type}?context=edit&per_page=1&_fields=meta`, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Array<{ meta?: Record<string, unknown> }>;
      const keys = Object.keys(data[0]?.meta ?? {});
      if (keys.some((k) => k.startsWith("_yoast_wpseo"))) return "yoast";
      if (keys.some((k) => k.startsWith("rank_math"))) return "rankmath";
      if (keys.some((k) => k.startsWith("_aioseo"))) return "aioseo";
      return "none";
    } catch { continue; }
  }
  return "none";
}

export async function probeCmsCapabilities(
  cmsType: CmsType,
  credentials: unknown,
): Promise<CmsCapabilities> {
  const probeAt = new Date().toISOString();

  if (cmsType === "wordpress") {
    const creds = credentials as CmsCredentials["wordpress"];
    const plugin = await detectWordPressPlugin(creds);
    return {
      meta_title: true,               // native title always works for posts/pages
      meta_description: plugin !== "none", // WordPress has no native meta description field — requires Yoast, Rank Math, or AIOSEO
      h1: true,                       // native title changes H1
      probeAt,
    };
  }

  if (cmsType === "github") {
    const creds = credentials as CmsCredentials["github"];
    const fw = creds.framework as GitHubFramework;
    // Django/Laravel require per-page template path configuration before any fix can be pushed
    if (fw === "django" || fw === "laravel") {
      const hasTemplatePaths = Object.keys(creds.templatePaths ?? {}).length > 0;
      return { meta_title: hasTemplatePaths, meta_description: hasTemplatePaths, h1: false, probeAt };
    }
    // H1 in source files requires manual edit; title/description modifiable for known frameworks
    const canModify = fw !== "unknown";
    return { meta_title: canModify, meta_description: canModify, h1: false, probeAt };
  }

  // Shopify and Webflow expose all three fields via their management APIs
  return { meta_title: true, meta_description: true, h1: true, probeAt };
}
