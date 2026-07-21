"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { connectWordPress, connectShopify, connectWebflow, disconnectCms } from "@/app/actions/cms.actions";
import type { CmsConnectionState } from "@/app/actions/cms.actions";
import { updateGitHubFramework } from "@/app/actions/quality.actions";
import type { GitHubFramework } from "@/lib/cms/types";
import { GithubRepoForm } from "./github-repo-form";

type CmsType = "wordpress" | "shopify" | "webflow" | "github";

type Props = {
  websiteId: string;
  initialState: CmsConnectionState;
  githubStep?: string | null;
};

const CMS_LABELS: Record<CmsType, string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  webflow: "Webflow",
  github: "Custom / GitHub",
};

const FRAMEWORK_LABELS: Record<string, string> = {
  "nextjs-app": "Next.js App Router",
  "nextjs-pages": "Next.js Pages Router",
  hugo: "Hugo",
  jekyll: "Jekyll",
  gatsby: "Gatsby",
  "react-helmet": "React (react-helmet)",
  django: "Django",
  laravel: "Laravel",
  unknown: "Unknown framework",
};

export function CmsConnectForm({ websiteId, initialState, githubStep }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [cmsType, setCmsType] = useState<CmsType>(githubStep ? "github" : "wordpress");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // WordPress fields
  const [wpUrl, setWpUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpPassword, setWpPassword] = useState("");

  // Shopify fields
  const [shopifyUrl, setShopifyUrl] = useState("");
  const [shopifyToken, setShopifyToken] = useState("");

  // Webflow fields
  const [wfToken, setWfToken] = useState("");
  const [wfCollectionId, setWfCollectionId] = useState("");

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      let result: { success: boolean; error?: string; connectedAs?: string };

      if (cmsType === "wordpress") {
        result = await connectWordPress(websiteId, wpUrl, wpUsername, wpPassword);
      } else if (cmsType === "shopify") {
        result = await connectShopify(websiteId, shopifyUrl, shopifyToken);
      } else {
        result = await connectWebflow(websiteId, wfToken, wfCollectionId);
      }

      if (result.success) {
        router.refresh();
        setState({
          connected: true,
          cmsType,
          connectedAs: result.connectedAs ?? "",
          connectedAt: new Date().toISOString(),
          connectionId: "",
        });
      } else {
        setError(result.error ?? "Connection failed");
      }
    });
  }

  function handleDisconnect() {
    if (!state.connected) return;
    startTransition(async () => {
      await disconnectCms(websiteId, state.cmsType);
      router.refresh();
      setState({ connected: false });
    });
  }

  // GitHub step 2: OAuth token stored but repo details not yet entered.
  // Show the repo form even though the connection record already exists.
  if (githubStep === "2" && (!state.connected || (state.connected && state.cmsType === "github"))) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <GithubRepoForm websiteId={websiteId} />
      </div>
    );
  }

  if (state.connected) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
              <p className="text-sm font-medium">{CMS_LABELS[state.cmsType as CmsType] ?? state.cmsType} connected</p>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{state.connectedAs}</p>
            {state.framework && (
              <FrameworkEditor
                websiteId={websiteId}
                currentFramework={state.framework}
              />
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connected {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(state.connectedAt))}
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* CMS type selector */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["wordpress", "shopify", "webflow", "github"] as CmsType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => { setCmsType(type); setError(null); }}
            className={[
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              cmsType === type
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
            ].join(" ")}
          >
            {CMS_LABELS[type]}
          </button>
        ))}
      </div>

      {/* GitHub: OAuth redirect step OR repo config step */}
      {cmsType === "github" && (
        <div className="space-y-4">
          {githubStep === "2" ? (
            <GithubRepoForm websiteId={websiteId} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your GitHub repository to push SEO fixes as pull requests.
                SaleBoom will create a branch, commit the change, and open a PR for your team to review.
              </p>
              <a
                href={`/api/github/connect?websiteId=${websiteId}`}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Authorize GitHub
              </a>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleConnect} className={["space-y-4", cmsType === "github" ? "hidden" : ""].join(" ")}>
        {/* WordPress fields */}
        {cmsType === "wordpress" && (
          <>
            <Field id="wp-url" label="WordPress site URL" type="url" required placeholder="https://yoursite.com" value={wpUrl} onChange={setWpUrl} />
            <Field id="wp-user" label="WordPress username" type="text" required autoComplete="username" placeholder="admin" value={wpUsername} onChange={setWpUsername} />
            <Field
              id="wp-pass"
              label="Application password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              value={wpPassword}
              onChange={setWpPassword}
              mono
              hint="Generate in WordPress → Users → Profile → Application Passwords"
            />
          </>
        )}

        {/* Shopify fields */}
        {cmsType === "shopify" && (
          <>
            <Field id="shopify-url" label="Shopify store URL" type="url" required placeholder="https://yourstore.myshopify.com" value={shopifyUrl} onChange={setShopifyUrl} hint="Use your .myshopify.com URL, e.g. https://seo-test-1qwtfiyp.myshopify.com — not the admin.shopify.com URL" />
            <Field
              id="shopify-token"
              label="Admin API access token"
              type="password"
              required
              autoComplete="new-password"
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
              value={shopifyToken}
              onChange={setShopifyToken}
              mono
              hint="Create in Shopify Admin → Apps → Develop Apps → your app → Admin API access token"
            />
          </>
        )}

        {/* Webflow fields */}
        {cmsType === "webflow" && (
          <>
            <Field
              id="wf-token"
              label="Webflow API token"
              type="password"
              required
              autoComplete="new-password"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={wfToken}
              onChange={setWfToken}
              mono
              hint="Generate in Webflow → Account Settings → Integrations → API Access"
            />
            <Field
              id="wf-collection"
              label="CMS collection ID"
              type="text"
              required
              placeholder="64a1234bcde5f60012345678"
              value={wfCollectionId}
              onChange={setWfCollectionId}
              mono
              hint="Found in Webflow → CMS → your collection → collection settings URL"
            />
          </>
        )}

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
          {isPending ? "Validating connection…" : `Connect ${CMS_LABELS[cmsType]}`}
        </button>
      </form>
    </div>
  );
}

function Field({
  id, label, type, required, placeholder, value, onChange, hint, mono, autoComplete,
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
  autoComplete?: string;
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
        autoComplete={autoComplete}
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

const FRAMEWORK_OPTIONS: { value: GitHubFramework; label: string }[] = [
  { value: "nextjs-app", label: "Next.js (App Router)" },
  { value: "nextjs-pages", label: "Next.js (Pages Router)" },
  { value: "hugo", label: "Hugo" },
  { value: "jekyll", label: "Jekyll" },
  { value: "gatsby", label: "Gatsby" },
  { value: "react-helmet", label: "React (react-helmet)" },
  { value: "django", label: "Django" },
  { value: "laravel", label: "Laravel" },
  { value: "unknown", label: "Unknown" },
];

function FrameworkEditor({ websiteId, currentFramework }: { websiteId: string; currentFramework: string }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentFramework);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <div className="mt-0.5 flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary/50"
        >
          {FRAMEWORK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateGitHubFramework(websiteId, selected as GitHubFramework);
              setEditing(false);
            })
          }
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      Framework:{" "}
      <span className="font-medium text-foreground">
        {FRAMEWORK_LABELS[selected] ?? selected}
      </span>
      <button
        onClick={() => setEditing(true)}
        aria-label="Edit framework"
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        ✎
      </button>
      <span className="text-muted-foreground/40">· Wrong? Change it here</span>
    </p>
  );
}
