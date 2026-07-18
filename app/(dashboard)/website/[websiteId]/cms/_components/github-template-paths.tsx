"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { updateGitHubTemplatePaths } from "@/app/actions/cms.actions";

type Props = {
  websiteId: string;
  framework: "django" | "laravel";
  initialPaths: Record<string, string>;
};

const FRAMEWORK_HINTS: Record<"django" | "laravel", { pathHint: string; example: string }> = {
  django: {
    pathHint: "Relative path to the template file in the repo",
    example: "templates/pages/about.html",
  },
  laravel: {
    pathHint: "Relative path to the Blade template file in the repo",
    example: "resources/views/pages/about.blade.php",
  },
};

export function GithubTemplatePaths({ websiteId, framework, initialPaths }: Props) {
  const [paths, setPaths] = useState<Record<string, string>>(initialPaths);
  const [newPageUrl, setNewPageUrl] = useState("");
  const [newFilePath, setNewFilePath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { pathHint, example } = FRAMEWORK_HINTS[framework];

  function addMapping() {
    const key = newPageUrl.trim();
    const val = newFilePath.trim();
    if (!key || !val) return;
    // Normalize page URL to pathname
    let normalized = key;
    try { normalized = new URL(key).pathname; } catch { /* use as-is */ }
    if (!normalized.startsWith("/")) normalized = `/${normalized}`;
    setPaths((prev) => ({ ...prev, [normalized]: val }));
    setNewPageUrl("");
    setNewFilePath("");
    setSaved(false);
  }

  function removeMapping(key: string) {
    setPaths((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateGitHubTemplatePaths(websiteId, paths);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error ?? "Save failed");
      }
    });
  }

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/20 p-5">
      <div>
        <h2 className="text-sm font-semibold">Template path configuration</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {framework === "django" ? "Django" : "Laravel"} templates are not discoverable from the URL alone —
          each page needs a one-time mapping from its URL path to its template file in the repository.
          Once configured, SEO fixes for that page are pushed as pull requests automatically.
        </p>
      </div>

      {/* Existing mappings */}
      {Object.keys(paths).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(paths).map(([pageUrl, filePath]) => (
            <div key={pageUrl} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{pageUrl}</span>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{filePath}</span>
              <button
                type="button"
                onClick={() => removeMapping(pageUrl)}
                className="shrink-0 text-xs text-muted-foreground hover:text-red-400"
                aria-label={`Remove mapping for ${pageUrl}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new mapping */}
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Page URL path</label>
            <input
              type="text"
              placeholder="/about"
              value={newPageUrl}
              onChange={(e) => setNewPageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMapping()}
              className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <span className="mb-2 text-xs text-muted-foreground">→</span>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{pathHint}</label>
            <input
              type="text"
              placeholder={example}
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMapping()}
              className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={addMapping}
          disabled={!newPageUrl.trim() || !newFilePath.trim()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
        >
          + Add mapping
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="btn-press rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save template paths"}
        </button>
        {saved && <span className="text-xs text-green-400">Saved — quick-fix classification updated</span>}
      </div>
    </div>
  );
}
