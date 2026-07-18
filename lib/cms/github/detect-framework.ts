import type { GitHubFramework } from "@/lib/cms/types";

type GhEntry = { name: string; type: "file" | "dir" | "symlink" | "submodule" };

async function listDir(owner: string, repo: string, token: string, path: string): Promise<GhEntry[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "SaleBoomSEO" },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) return [];
  const data = await res.json() as GhEntry | GhEntry[];
  return Array.isArray(data) ? data : [];
}

async function fetchFileText(owner: string, repo: string, token: string, path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "SaleBoomSEO" },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) return null;
  const data = await res.json() as { content?: string };
  if (!data.content) return null;
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function detectFramework(
  owner: string,
  repo: string,
  token: string,
  subPath = "",
): Promise<GitHubFramework> {
  const entries = await listDir(owner, repo, token, subPath);
  const names = new Set(entries.map((e) => e.name));

  const prefix = subPath ? `${subPath}/` : "";

  // Gatsby: gatsby-config.js/ts at root
  if (names.has("gatsby-config.js") || names.has("gatsby-config.ts") || names.has("gatsby-config.mjs")) {
    return "gatsby";
  }

  // Next.js
  const hasNextConfig = names.has("next.config.js") || names.has("next.config.ts")
    || names.has("next.config.mjs") || names.has("next.config.cjs");

  if (hasNextConfig) {
    if (names.has("app")) return "nextjs-app";
    if (names.has("pages")) return "nextjs-pages";
    if (names.has("src")) {
      const src = await listDir(owner, repo, token, `${prefix}src`);
      const srcNames = new Set(src.map((e) => e.name));
      if (srcNames.has("app")) return "nextjs-app";
      if (srcNames.has("pages")) return "nextjs-pages";
    }
    return "nextjs-app";
  }

  // Jekyll
  if (names.has("_config.yml") || names.has("_config.yaml")) return "jekyll";

  // Hugo
  if (
    (names.has("config.toml") || names.has("config.yaml") || names.has("config.yml")
      || names.has("hugo.toml") || names.has("hugo.yaml")) &&
    names.has("layouts")
  ) return "hugo";

  // Django: manage.py in root
  if (names.has("manage.py")) return "django";

  // Laravel: artisan in root
  if (names.has("artisan")) return "laravel";

  // React Helmet: check package.json dependencies
  if (names.has("package.json")) {
    const pkgText = await fetchFileText(owner, repo, token, `${prefix}package.json`);
    if (pkgText) {
      try {
        const pkg = JSON.parse(pkgText) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if ("react-helmet" in allDeps || "react-helmet-async" in allDeps) return "react-helmet";
      } catch { /* ignore */ }
    }
  }

  return "unknown";
}
