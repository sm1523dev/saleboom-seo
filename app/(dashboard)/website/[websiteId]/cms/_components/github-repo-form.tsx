"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { connectGitHub } from "@/app/actions/cms.actions";

const FRAMEWORK_LABELS: Record<string, string> = {
  "nextjs-app": "Next.js (App Router)",
  "nextjs-pages": "Next.js (Pages Router)",
  hugo: "Hugo",
  jekyll: "Jekyll",
  unknown: "Unknown — connect and re-probe after setup",
};

type Props = {
  websiteId: string;
};

export function GithubRepoForm({ websiteId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [detectedFramework, setDetectedFramework] = useState<string | null>(null);

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [subPath, setSubPath] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await connectGitHub(websiteId, owner, repo, branch, subPath || undefined);
      if (result.success) {
        setDetectedFramework(result.framework ?? "unknown");
        router.refresh();
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
          <span className="font-medium">{owner}/{repo}</span> — detected framework:{" "}
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
        {"GitHub authorized. Now tell us which repository contains this site's code."}
      </p>

      <Field
        id="gh-owner"
        label="Repository owner"
        type="text"
        required
        placeholder="acme-corp"
        value={owner}
        onChange={setOwner}
        hint="Your GitHub username or organization name"
      />
      <Field
        id="gh-repo"
        label="Repository name"
        type="text"
        required
        placeholder="acme-website"
        value={repo}
        onChange={setRepo}
      />
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
        disabled={isPending}
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
