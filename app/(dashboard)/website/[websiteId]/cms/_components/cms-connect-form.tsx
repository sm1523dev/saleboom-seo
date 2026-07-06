"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { connectWordPress, connectShopify, connectWebflow, disconnectCms } from "@/app/actions/cms.actions";
import type { CmsConnectionState } from "@/app/actions/cms.actions";

type CmsType = "wordpress" | "shopify" | "webflow";

type Props = {
  websiteId: string;
  initialState: CmsConnectionState;
};

const CMS_LABELS: Record<CmsType, string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  webflow: "Webflow",
};

export function CmsConnectForm({ websiteId, initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [cmsType, setCmsType] = useState<CmsType>("wordpress");
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

  if (state.connected) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
              <p className="text-sm font-medium">{CMS_LABELS[state.cmsType]} connected</p>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{state.connectedAs}</p>
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
      <div className="mb-5 flex gap-2">
        {(["wordpress", "shopify", "webflow"] as CmsType[]).map((type) => (
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

      <form onSubmit={handleConnect} className="space-y-4">
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
            <Field id="shopify-url" label="Shopify store URL" type="url" required placeholder="https://yourstore.myshopify.com" value={shopifyUrl} onChange={setShopifyUrl} />
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
