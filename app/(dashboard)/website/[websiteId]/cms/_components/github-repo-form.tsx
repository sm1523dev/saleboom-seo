"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { connectGitHub } from "@/app/actions/cms.actions";

const FRAMEWORK_LABELS: Record<string, string> = {
  "nextjs-app": "Next.js (App Router)",
  "nextjs-pages": "Next.js (Pages Router)",
  hugo: "Hugo",
  jekyll: "Jekyll",
  gatsby: "Gatsby",
  "react-helmet": "React (react-helmet)",
  django: "Django — template paths required",
  laravel: "Laravel — template paths required",
  unknown: "Unknown — connect and re-probe after setup",
};

type Repo = { fullName: string; owner: string; name: string; defaultBranch: string; private: boolean };

type Props = { websiteId: string };

export function GithubRepoForm({ websiteId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [detectedFramework, setDetectedFramework] = useState<string | null>(null);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Repo | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const [branch, setBranch] = useState("main");
  const [subPath, setSubPath] = useState("");

  useEffect(() => {
    fetch(`/api/github/repos?websiteId=${websiteId}`)
      .then((r) => r.json())
      .then((data: { repos?: Repo[]; error?: string }) => {
        if (data.repos) setRepos(data.repos);
        else setReposError(data.error ?? "Failed to load repositories");
      })
      .catch(() => setReposError("Failed to load repositories"))
      .finally(() => setReposLoading(false));
  }, [websiteId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query
    ? repos.filter((r) => r.fullName.toLowerCase().includes(query.toLowerCase()))
    : repos;

  function selectRepo(repo: Repo) {
    setSelected(repo);
    setQuery(repo.fullName);
    setBranch(repo.defaultBranch);
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await connectGitHub(websiteId, selected.owner, selected.name, branch, subPath || undefined);
      if (result.success) {
        setDetectedFramework(result.framework ?? "unknown");
        router.push(`/website/${websiteId}/cms`);
      } else {
        setError(result.error ?? "Failed to save repository settings");
      }
    });
  }

  if (detectedFramework) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-green-500/30 bg-green-500/10 p-6"
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
          <p className="text-sm font-medium text-green-400">GitHub repository connected</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">{selected?.fullName}</span> — detected framework:{" "}
          <span className="font-medium">{FRAMEWORK_LABELS[detectedFramework] ?? detectedFramework}</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          SaleBoom will push SEO fixes as pull requests on this repository.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {"GitHub authorized. Select the repository that contains this site's code."}
      </p>

      {/* Repository combobox */}
      <div>
        <label htmlFor="gh-repo-search" className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Repository
        </label>
        <div ref={comboboxRef} className="relative">
          <input
            id="gh-repo-search"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="gh-repo-listbox"
            autoComplete="off"
            placeholder={reposLoading ? "Loading repositories…" : "Search owner/repo…"}
            disabled={reposLoading || !!reposError}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); setSelected(null); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered.length === 1) { e.preventDefault(); selectRepo(filtered[0]); }
            }}
            className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 disabled:opacity-50 font-mono"
          />
          {reposLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          )}

          <AnimatePresence>
            {open && !reposLoading && filtered.length > 0 && (
              <motion.ul
                id="gh-repo-listbox"
                role="listbox"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
              >
                {filtered.map((repo) => (
                  <li
                    key={repo.fullName}
                    role="option"
                    aria-selected={selected?.fullName === repo.fullName}
                    onMouseDown={(e) => { e.preventDefault(); selectRepo(repo); }}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-muted/60 aria-selected:bg-primary/10"
                  >
                    <span className="font-mono">{repo.fullName}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{repo.private ? "private" : "public"}</span>
                  </li>
                ))}
                {repos.length === 100 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                    Showing 100 most recently updated repos — type to filter
                  </li>
                )}
              </motion.ul>
            )}
            {open && !reposLoading && query && filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted-foreground shadow-lg"
              >
                No repositories match &quot;{query}&quot;
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {reposError && <p className="mt-1.5 text-xs text-red-400">{reposError}</p>}
      </div>

      {/* Branch — shown once a repo is selected */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4 overflow-hidden"
          >
            <Field
              id="gh-branch"
              label="Base branch"
              type="text"
              required
              placeholder="main"
              value={branch}
              onChange={setBranch}
              hint="PRs will be opened against this branch (usually main or master)"
              mono
            />
            <Field
              id="gh-subpath"
              label="Sub-path (optional)"
              type="text"
              placeholder="apps/marketing"
              value={subPath}
              onChange={setSubPath}
              hint="For monorepos: path to the website within the repository"
              mono
            />
          </motion.div>
        )}
      </AnimatePresence>

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

      <button
        type="submit"
        disabled={isPending || !selected}
        className="btn-press w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Detecting framework…" : "Save repository settings"}
      </button>
    </form>
  );
}

function Field({
  id, label, type, required, placeholder, value, onChange, hint, mono,
}: {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none transition-colors",
          "placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
          mono ? "font-mono" : "",
        ].join(" ")}
      />
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
