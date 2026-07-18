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

export async function detectFramework(
  owner: string,
  repo: string,
  token: string,
  subPath = "",
): Promise<GitHubFramework> {
  const entries = await listDir(owner, repo, token, subPath);
  const names = new Set(entries.map((e) => e.name));

  const hasNextConfig = names.has("next.config.js") || names.has("next.config.ts")
    || names.has("next.config.mjs") || names.has("next.config.cjs");

  if (hasNextConfig) {
    if (names.has("app")) return "nextjs-app";
    if (names.has("pages")) return "nextjs-pages";
    // Could be App Router with src/ layout
    if (names.has("src")) {
      const src = await listDir(owner, repo, token, subPath ? `${subPath}/src` : "src");
      const srcNames = new Set(src.map((e) => e.name));
      if (srcNames.has("app")) return "nextjs-app";
      if (srcNames.has("pages")) return "nextjs-pages";
    }
    return "nextjs-app"; // default for modern Next.js projects
  }

  if (names.has("_config.yml") || names.has("_config.yaml")) return "jekyll";

  if (
    (names.has("config.toml") || names.has("config.yaml") || names.has("config.yml")
      || names.has("hugo.toml") || names.has("hugo.yaml")) &&
    names.has("layouts")
  ) return "hugo";

  return "unknown";
}
