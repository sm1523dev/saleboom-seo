"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toggleAeoProvider, updateAeoProvider } from "@/app/actions/providers.actions";

type AeoProvider = {
  id: string;
  displayName: string;
  providerType: string;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  model: string;
  enabled: boolean;
};

interface EditFormState {
  displayName: string;
  model: string;
  endpointUrl: string;
  apiKeyEnvVar: string;
}

function ProviderTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground">
      {type}
    </span>
  );
}

function ProviderRow({ provider }: { provider: AeoProvider }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editForm, setEditForm] = useState<EditFormState>({
    displayName: provider.displayName,
    model: provider.model,
    endpointUrl: provider.endpointUrl ?? "",
    apiKeyEnvVar: provider.apiKeyEnvVar ?? "",
  });

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleAeoProvider(provider.id, !provider.enabled);
      if (!result.success && result.error) {
        // eslint-disable-next-line no-console
        console.error("[providers]", result.error);
      }
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateAeoProvider(provider.id, {
        displayName: editForm.displayName,
        model: editForm.model,
        endpointUrl: editForm.endpointUrl.trim() || null,
        apiKeyEnvVar: editForm.apiKeyEnvVar.trim() || null,
      });
      if (result.success) {
        setIsEditing(false);
      } else if (result.error) {
        // eslint-disable-next-line no-console
        console.error("[providers]", result.error);
      }
    });
  }

  function handleCancel() {
    setEditForm({
      displayName: provider.displayName,
      model: provider.model,
      endpointUrl: provider.endpointUrl ?? "",
      apiKeyEnvVar: provider.apiKeyEnvVar ?? "",
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        className="px-5 py-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <ProviderTypeBadge type={provider.providerType} />
          <span className="text-xs text-muted-foreground">Editing provider</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Display name
            </span>
            <input
              type="text"
              value={editForm.displayName}
              onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
              className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              placeholder="e.g. ChatGPT-4o"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Model
            </span>
            <input
              type="text"
              value={editForm.model}
              onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
              className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              placeholder="e.g. gpt-4o"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Endpoint URL
            </span>
            <input
              type="text"
              value={editForm.endpointUrl}
              onChange={(e) => setEditForm((f) => ({ ...f, endpointUrl: e.target.value }))}
              className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              placeholder="https://api.example.com/v1 (optional)"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              API key env var
            </span>
            <input
              type="text"
              value={editForm.apiKeyEnvVar}
              onChange={(e) => setEditForm((f) => ({ ...f, apiKeyEnvVar: e.target.value }))}
              className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              placeholder="OPENAI_API_KEY (optional)"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-md border border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center gap-4 px-5 py-4"
    >
      {/* Left: name, model, type */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{provider.displayName}</span>
          <ProviderTypeBadge type={provider.providerType} />
        </div>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{provider.model}</p>
      </div>

      {/* Middle: env var */}
      <div className="hidden shrink-0 lg:block">
        {provider.apiKeyEnvVar ? (
          <span className="font-mono text-xs text-muted-foreground">{provider.apiKeyEnvVar}</span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Right: status + actions */}
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={[
            "hidden items-center rounded-full border px-2 py-0.5 text-xs font-medium sm:inline-flex",
            provider.enabled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-border bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {provider.enabled ? "Enabled" : "Disabled"}
        </span>

        <button
          onClick={handleToggle}
          disabled={isPending}
          className={[
            "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-40",
            provider.enabled
              ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          ].join(" ")}
        >
          {isPending ? "…" : provider.enabled ? "Disable" : "Enable"}
        </button>

        <button
          onClick={() => setIsEditing(true)}
          disabled={isPending}
          className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Edit
        </button>
      </div>
    </motion.div>
  );
}

interface AeoProviderListProps {
  providers: AeoProvider[];
}

export function AeoProviderList({ providers }: AeoProviderListProps) {
  if (providers.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No AEO providers configured.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Seed providers via the CLI to enable AEO queries.
        </p>
      </div>
    );
  }

  return (
    <div className="card-glow overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
      <AnimatePresence initial={false}>
        {providers.map((provider) => (
          <ProviderRow key={provider.id} provider={provider} />
        ))}
      </AnimatePresence>
    </div>
  );
}
