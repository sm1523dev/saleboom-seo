"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toggleAeoProvider, updateAeoProvider, deleteAeoProvider, setAeoProviderKey, addAeoProvider } from "@/app/actions/providers.actions";

type AeoProvider = {
  id: string;
  displayName: string;
  providerType: string;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  encryptedKeyBlob: string | null;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const [keyPending, startKeyTransition] = useTransition();
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

  function handleDelete() {
    startTransition(async () => {
      await deleteAeoProvider(provider.id);
    });
  }

  function handleSaveKey() {
    startKeyTransition(async () => {
      const result = await setAeoProviderKey(provider.id, keyValue);
      if (result.success) {
        setKeyStatus("saved");
        setKeyValue("");
        setShowKeyInput(false);
        setTimeout(() => setKeyStatus("idle"), 2500);
      } else {
        setKeyStatus("error");
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

      {/* Middle: key status */}
      <div className="hidden shrink-0 flex-col gap-1 lg:flex">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${provider.encryptedKeyBlob ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
          <span className="font-mono text-xs text-muted-foreground">
            {provider.encryptedKeyBlob ? "key stored" : (provider.apiKeyEnvVar ?? "no key")}
          </span>
        </div>
        {showKeyInput ? (
          <div className="flex items-center gap-1">
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="Paste key…"
              className="w-36 rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-foreground outline-none focus:border-primary/50"
            />
            <button
              onClick={handleSaveKey}
              disabled={keyPending || !keyValue.trim()}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-primary hover:text-primary/80 disabled:opacity-40"
            >
              {keyPending ? "…" : "save"}
            </button>
            <button onClick={() => setShowKeyInput(false)} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setShowKeyInput(true)}
            className="text-left text-[10px] text-muted-foreground/40 hover:text-primary"
          >
            {provider.encryptedKeyBlob ? "rotate key" : "set key"}
          </button>
        )}
        {keyStatus === "saved" && <span className="text-[10px] text-emerald-400">Saved.</span>}
        {keyStatus === "error" && <span className="text-[10px] text-red-400">Failed.</span>}
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

        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
              className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground/60 transition-colors hover:border-red-500/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        )}
      </div>
    </motion.div>
  );
}

const PRESETS = [
  { label: "NVIDIA NIM", providerType: "openai-compat", model: "meta/llama-3.3-70b-instruct", endpointUrl: "https://integrate.api.nvidia.com/v1" },
  { label: "OpenAI GPT-4o", providerType: "openai-compat", model: "gpt-4o", endpointUrl: "" },
  { label: "Anthropic Claude", providerType: "anthropic", model: "claude-3-5-sonnet-20241022", endpointUrl: "" },
  { label: "Groq Llama 3.3", providerType: "openai-compat", model: "llama-3.3-70b-versatile", endpointUrl: "https://api.groq.com/openai/v1" },
  { label: "Perplexity", providerType: "openai-compat", model: "llama-3.1-sonar-large-128k-online", endpointUrl: "https://api.perplexity.ai" },
  { label: "Google Gemini", providerType: "openai-compat", model: "gemini-2.0-flash", endpointUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { label: "Custom", providerType: "openai-compat", model: "", endpointUrl: "" },
];

type AddFormState = {
  displayName: string;
  providerType: string;
  model: string;
  endpointUrl: string;
  apiKeyEnvVar: string;
  plainKey: string;
};

function AddProviderForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<AddFormState>({
    displayName: "",
    providerType: "openai-compat",
    model: "",
    endpointUrl: "",
    apiKeyEnvVar: "",
    plainKey: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyPreset(preset: typeof PRESETS[number]) {
    setForm((f) => ({
      ...f,
      displayName: preset.label,
      providerType: preset.providerType,
      model: preset.model,
      endpointUrl: preset.endpointUrl,
    }));
  }

  function patch(partial: Partial<AddFormState>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function handleAdd() {
    if (!form.displayName.trim()) { setError("Display name required."); return; }
    if (!form.model.trim()) { setError("Model required."); return; }
    startTransition(async () => {
      const res = await addAeoProvider({
        displayName: form.displayName,
        providerType: form.providerType,
        model: form.model,
        endpointUrl: form.endpointUrl || null,
        apiKeyEnvVar: form.apiKeyEnvVar || null,
        plainKey: form.plainKey || null,
      });
      if (res.success) {
        onClose();
      } else {
        setError(res.error ?? "Failed to add provider.");
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="border-t border-border px-5 py-5"
    >
      {/* Presets */}
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Quick start</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Display name</span>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => patch({ displayName: e.target.value })}
            placeholder="e.g. ChatGPT-4o"
            className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Model</span>
          <input
            type="text"
            value={form.model}
            onChange={(e) => patch({ model: e.target.value })}
            placeholder="e.g. gpt-4o"
            className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Endpoint URL (optional)</span>
          <input
            type="text"
            value={form.endpointUrl}
            onChange={(e) => patch({ endpointUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
            className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">API Key</span>
          <input
            type="password"
            value={form.plainKey}
            onChange={(e) => patch({ plainKey: e.target.value })}
            placeholder="Paste key — encrypted at rest"
            className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="rounded-md border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Adding…" : "Add provider"}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          className="rounded-md border border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

interface AeoProviderListProps {
  providers: AeoProvider[];
}

export function AeoProviderList({ providers }: AeoProviderListProps) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="card-glow overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {providers.length === 0
            ? "No providers — AEO scans will be skipped"
            : `${providers.filter((p) => p.enabled).length} of ${providers.length} active`}
        </p>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          {showAdd ? "Cancel" : "+ Add provider"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showAdd && <AddProviderForm key="add-form" onClose={() => setShowAdd(false)} />}
      </AnimatePresence>

      {providers.length === 0 && !showAdd ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">No AEO providers configured.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Add a provider above to enable AEO brand-mention scanning.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {providers.map((provider) => (
              <ProviderRow key={provider.id} provider={provider} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
