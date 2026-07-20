import type { CmsAdapter, CmsCredentials, PushPayload, PushResult, ValidationResult, CmsField } from "@/lib/cms/types";
import { PrCreationEngine, buildPrBody } from "@/lib/cms/github/pr-engine";
import { modifyAppRouterMetadata, modifyPagesRouterHead, getNextjsFilePaths } from "@/lib/cms/github/modifiers/nextjs";
import { modifyFrontMatter, hugoFilePaths, jekyllFilePaths } from "@/lib/cms/github/modifiers/front-matter";
import { modifyGatsbyHead, getGatsbyFilePaths } from "@/lib/cms/github/modifiers/gatsby";
import { modifyReactHelmet, getReactHelmetFilePaths } from "@/lib/cms/github/modifiers/react-helmet";
import { modifyDjangoTemplate } from "@/lib/cms/github/modifiers/django";
import { modifyLaravelBlade } from "@/lib/cms/github/modifiers/laravel";

type GhCreds = CmsCredentials["github"];

export class GitHubAdapter implements CmsAdapter<"github"> {
  async validate(credentials: GhCreds): Promise<ValidationResult> {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "SaleBoomSEO",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      if (res.status === 401) return { valid: false, error: "Invalid or expired GitHub token" };
      return { valid: false, error: `GitHub API error: ${res.status}` };
    }

    const data = (await res.json()) as { login: string };
    return { valid: true, userLogin: data.login };
  }

  async push(payload: PushPayload, credentials: GhCreds): Promise<PushResult> {
    const { pageUrl, fields, beforeFields } = payload;
    const { accessToken, repoOwner, repoName, baseBranch, framework, subPath, templatePaths } = credentials;

    if (framework === "unknown") {
      throw new Error("Framework not detected — reconnect the repository to re-probe framework");
    }

    const engine = new PrCreationEngine(accessToken, repoOwner, repoName, baseBranch);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const pushedFields: CmsField[] = [];
    // Group all fields into a single branch + PR for this page
    const fieldEntries = Object.entries(fields).filter(([, v]) => v !== undefined) as [CmsField, string][];
    if (fieldEntries.length === 0) {
      throw new Error("No fields provided to push");
    }

    // Use the first field for branch naming; multi-field uses "meta"
    const branchFieldSlug = fieldEntries.length === 1 ? fieldEntries[0][0].replace("_", "-") : "meta";
    const branchName = await engine.buildBranchName(`seo-${branchFieldSlug}-${slugFromUrl(pageUrl)}`, today);

    let branchCreated = false;

    for (const [field, newValue] of fieldEntries) {
      const filePaths = resolveFilePaths(pageUrl, framework, subPath, templatePaths);

      // Find first existing file
      let foundPath: string | null = null;
      let fileMeta: { sha: string; content: string } | null = null;
      for (const fp of filePaths) {
        if (await engine.fileExists(fp)) {
          foundPath = fp;
          fileMeta = await engine.getFile(fp);
          break;
        }
      }

      // Fallback: probe route groups dynamically (Next.js App Router uses (group) dirs)
      if (!foundPath && (framework === "nextjs-app" || framework === "nextjs-pages")) {
        const discovered = await discoverViaRouteGroups(engine, pageUrl, framework, subPath);
        if (discovered) {
          foundPath = discovered.path;
          fileMeta = discovered.meta;
        }
      }

      if (!foundPath || !fileMeta) {
        const isNoTemplatePath = filePaths[0]?.startsWith("__no_template_path_for_");
        if (isNoTemplatePath) {
          let lookupKey = pageUrl;
          try { lookupKey = new URL(pageUrl).pathname; } catch { /* ok */ }
          throw new Error(
            `No template path configured for "${lookupKey}". ` +
            `Add it in your GitHub repository settings (CMS → Custom / GitHub → Template paths).`,
          );
        }
        throw new Error(`Could not locate source file for ${pageUrl} (tried: ${filePaths.slice(0, 3).join(", ")})`);
      }

      const result = applyModifier(fileMeta.content, framework, field, newValue);
      if (!result.modified) throw new Error(result.error);

      if (!branchCreated) {
        await engine.createBranch(branchName);
        branchCreated = true;
      }

      await engine.commitFile(
        foundPath,
        result.content,
        `seo: update ${fieldLabel(field)} on /${slugFromUrl(pageUrl)}`,
        branchName,
        fileMeta.sha,
      );

      pushedFields.push(field);
    }

    // Build PR
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const prResult = await engine.createPr(
      branchName,
      `seo: update ${fieldEntries.map(([f]) => fieldLabel(f)).join(", ")} on /${slugFromUrl(pageUrl)}`,
      buildPrBody({
        field: fieldEntries[0][0],
        pageUrl,
        beforeValue: beforeFields?.[fieldEntries[0][0]] ?? null,
        afterValue: fieldEntries[0][1],
        scanResultsUrl: appUrl,
      }),
    );

    return { success: true, pageId: pageUrl, pushedFields, prUrl: prResult.prUrl, prNumber: prResult.prNumber };
  }
}

function slugFromUrl(pageUrl: string): string {
  try {
    const path = new URL(pageUrl).pathname;
    return path.replace(/^\//, "").replace(/\//g, "-") || "home";
  } catch {
    return pageUrl.replace(/^\//, "").replace(/\//g, "-") || "home";
  }
}

function fieldLabel(field: string): string {
  if (field === "meta_title") return "page title";
  if (field === "meta_description") return "meta description";
  if (field === "h1") return "heading (H1)";
  return field;
}

function resolveFilePaths(
  pageUrl: string,
  framework: GhCreds["framework"],
  subPath?: string,
  templatePaths?: Record<string, string>,
): string[] {
  if (framework === "nextjs-app") return getNextjsFilePaths(pageUrl, "nextjs-app", subPath);
  if (framework === "nextjs-pages") return getNextjsFilePaths(pageUrl, "nextjs-pages", subPath);
  if (framework === "hugo") return hugoFilePaths(pageUrl, subPath);
  if (framework === "jekyll") return jekyllFilePaths(pageUrl, subPath);
  if (framework === "gatsby") return getGatsbyFilePaths(pageUrl, subPath);
  if (framework === "react-helmet") return getReactHelmetFilePaths(pageUrl, subPath);
  if (framework === "django" || framework === "laravel") {
    // Normalize pageUrl to just pathname for lookup
    let lookupKey = pageUrl;
    try { lookupKey = new URL(pageUrl).pathname; } catch { /* use as-is */ }
    const mapped = templatePaths?.[lookupKey] ?? templatePaths?.[pageUrl];
    if (!mapped) {
      // Return sentinel value — caught below with a helpful error
      return [`__no_template_path_for_${lookupKey}__`];
    }
    return [mapped];
  }
  return [];
}

function applyModifier(
  source: string,
  framework: GhCreds["framework"],
  field: CmsField,
  newValue: string,
): { modified: true; content: string } | { modified: false; error: string } {
  if (field === "h1") {
    return { modified: false, error: "H1 in source code requires manual edit — use meta_title as a proxy instead" };
  }

  if (framework === "nextjs-app") return modifyAppRouterMetadata(source, field, newValue);
  if (framework === "nextjs-pages") return modifyPagesRouterHead(source, field, newValue);
  if (framework === "hugo" || framework === "jekyll") return modifyFrontMatter(source, field, newValue);
  if (framework === "gatsby") return modifyGatsbyHead(source, field, newValue);
  if (framework === "react-helmet") return modifyReactHelmet(source, field, newValue);
  if (framework === "django") return modifyDjangoTemplate(source, field, newValue);
  if (framework === "laravel") return modifyLaravelBlade(source, field, newValue);

  return { modified: false, error: `Framework "${framework}" not yet supported` };
}

// Discover files inside Next.js route group directories — e.g. app/(public)/page.tsx
async function discoverViaRouteGroups(
  engine: PrCreationEngine,
  pageUrl: string,
  framework: "nextjs-app" | "nextjs-pages",
  subPath?: string,
): Promise<{ path: string; meta: { sha: string; content: string } } | null> {
  const prefix = subPath ? `${subPath.replace(/\/$/, "")}/` : "";
  const base = framework === "nextjs-app" ? `${prefix}app` : `${prefix}pages`;

  // List the base directory to find route groups (directories with parentheses)
  const res = await fetch(
    `https://api.github.com/repos/${engine["owner"]}/${engine["repo"]}/contents/${base}`,
    {
      headers: { Authorization: `Bearer ${engine["token"]}`, "User-Agent": "SaleBoomSEO" },
      signal: AbortSignal.timeout(8_000),
    },
  ).catch(() => null);

  if (!res?.ok) return null;

  const entries = (await res.json()) as Array<{ name: string; type: string }>;
  const routeGroups = entries.filter((e) => e.type === "dir" && e.name.startsWith("("));

  const pathname = (() => {
    try { return new URL(pageUrl).pathname.replace(/^\//, "").replace(/\/$/, ""); } catch { return ""; }
  })();

  const exts = ["tsx", "jsx", "ts", "js"];
  const pageFile = pathname === "" ? "page" : `${pathname}/page`;

  for (const group of routeGroups) {
    for (const ext of exts) {
      const candidate = `${base}/${group.name}/${pageFile}.${ext}`;
      if (await engine.fileExists(candidate)) {
        const meta = await engine.getFile(candidate);
        return { path: candidate, meta };
      }
    }
  }

  return null;
}
