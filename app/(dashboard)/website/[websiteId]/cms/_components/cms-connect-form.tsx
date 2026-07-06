"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { connectWordPress, disconnectCms } from "@/app/actions/cms.actions";
import type { CmsConnectionState } from "@/app/actions/cms.actions";

type Props = {
  websiteId: string;
  initialState: CmsConnectionState;
};

export function CmsConnectForm({ websiteId, initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [cmsType, setCmsType] = useState<"wordpress">("wordpress");
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await connectWordPress(websiteId, siteUrl, username, appPassword);
      if (result.success) {
        router.refresh();
        setState({
          connected: true,
          cmsType: "wordpress",
          connectedAs: result.connectedAs ?? username,
          connectedAt: new Date().toISOString(),
          connectionId: "",
        });
        setSiteUrl("");
        setUsername("");
        setAppPassword("");
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
              <p className="text-sm font-medium capitalize">{state.cmsType} connected</p>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {state.connectedAs}
            </p>
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
      {/* CMS type selector — extensible for Shopify/Webflow */}
      <div className="mb-5 flex gap-2">
        {(["wordpress"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setCmsType(type)}
            className={[
              "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              cmsType === type
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
            ].join(" ")}
          >
            {type}
          </button>
        ))}
        {(["shopify", "webflow"] as const).map((type) => (
          <button
            key={type}
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg border border-border px-3 py-1.5 text-xs font-medium capitalize text-muted-foreground/40"
          >
            {type}
          </button>
        ))}
      </div>

      <form onSubmit={handleConnect} className="space-y-4">
        <div>
          <label htmlFor="site-url" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            WordPress site URL
          </label>
          <input
            id="site-url"
            type="url"
            required
            placeholder="https://yoursite.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div>
          <label htmlFor="wp-username" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            WordPress username
          </label>
          <input
            id="wp-username"
            type="text"
            required
            autoComplete="username"
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div>
          <label htmlFor="app-password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Application password
          </label>
          <input
            id="app-password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Generate in WordPress → Users → Profile → Application Passwords
          </p>
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

        <button
          type="submit"
          disabled={isPending}
          className="btn-press w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Validating connection…" : "Connect WordPress"}
        </button>
      </form>
    </div>
  );
}
