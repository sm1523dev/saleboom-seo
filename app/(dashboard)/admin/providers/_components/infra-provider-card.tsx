"use client";

import { useState, useTransition } from "react";
import { switchInfraProvider, setInfraProviderKey } from "@/app/actions/providers.actions";
import { submitProviderRequest } from "@/app/actions/provider-requests.actions";

type Props = {
  type: "ai" | "crawl" | "queue" | "storage" | "notifications";
  label: string;
  icon: string;
  currentName: string;
  hasKey: boolean;
  switchMode: "runtime" | "restart" | "redeploy";
  options: string[];
  config: Record<string, string>;
};

const SWITCH_MODE_LABEL: Record<string, string> = {
  runtime: "switches at runtime",
  restart: "restart to apply",
  redeploy: "redeploy required",
};

const SWITCH_MODE_COLOR: Record<string, string> = {
  runtime: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  restart: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
  redeploy: "border-border bg-muted text-muted-foreground",
};

const OPENAI_COMPAT_PROVIDERS = new Set(["nim", "openai", "groq", "ollama", "custom", "mock"]);

export function InfraProviderCard({
  type, label, icon, currentName, hasKey, switchMode, options, config,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [selectedName, setSelectedName] = useState(currentName);
  const [customEndpoint, setCustomEndpoint] = useState(config.endpointUrl ?? "");
  const [customModel, setCustomModel] = useState(config.model ?? "");
  const [requestName, setRequestName] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "sent" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const [keyPending, startKeyTransition] = useTransition();
  const [requestPending, startRequestTransition] = useTransition();
  const [keyStatus, setKeyStatus] = useState<"idle" | "saved" | "error">("idle");

  const isCustom = selectedName === "custom";
  const isNonCompat = type === "ai" && !OPENAI_COMPAT_PROVIDERS.has(selectedName);

  function handleSaveProvider() {
    const providerConfig: Record<string, string> = isCustom
      ? { endpointUrl: customEndpoint.trim(), model: customModel.trim() }
      : {};
    startTransition(async () => {
      await switchInfraProvider(type, selectedName, providerConfig);
      setIsEditing(false);
    });
  }

  function handleSaveKey() {
    startKeyTransition(async () => {
      const result = await setInfraProviderKey(type, keyValue);
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

  function handleClearKey() {
    startKeyTransition(async () => {
      await setInfraProviderKey(type, "");
      setKeyStatus("idle");
    });
  }

  function handleSubmitRequest() {
    startRequestTransition(async () => {
      const result = await submitProviderRequest({
        type,
        providerName: requestName.trim(),
        reason: requestReason.trim(),
      });
      if (result.success) {
        setRequestStatus("sent");
        setRequestName("");
        setRequestReason("");
        setTimeout(() => { setRequestStatus("idle"); setShowRequestForm(false); }, 3000);
      } else {
        setRequestStatus("error");
      }
    });
  }

  return (
    <div className="card-glow rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-primary">{icon}</span>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${SWITCH_MODE_COLOR[switchMode]}`}>
          {SWITCH_MODE_LABEL[switchMode]}
        </span>
      </div>

      {/* Provider selector */}
      {isEditing ? (
        <div className="mt-3 space-y-2">
          <select
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary/50"
          >
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          {/* Custom config fields */}
          {isCustom && (
            <div className="space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Endpoint URL</span>
                <input
                  type="url"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/40 outline-none focus:border-primary/50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Model</span>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="openai/gpt-4o"
                  className="rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/40 outline-none focus:border-primary/50"
                />
              </label>
              <p className="text-[10px] text-muted-foreground/60">
                Works with any OpenAI-compatible endpoint — OpenRouter, Together, Mistral, LiteLLM, etc.
              </p>
            </div>
          )}

          {/* Non-OpenAI-compat warning */}
          {isNonCompat && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
              <p className="text-xs text-yellow-400 font-medium">Not OpenAI-compatible</p>
              <p className="mt-0.5 text-[10px] text-yellow-400/70">
                This provider requires a custom adapter. Use <strong>custom</strong> for any OpenAI-compatible endpoint, or submit a request for native support.
              </p>
            </div>
          )}

          <p className="text-[10px] text-yellow-500/80">
            ⚠ Switching clears the stored key — set a new key after saving.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSaveProvider}
              disabled={isPending || (isCustom && (!customEndpoint.trim() || !customModel.trim()))}
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setIsEditing(false); setSelectedName(currentName); }}
              className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-primary">{currentName}</p>
            <button onClick={() => setIsEditing(true)} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground">
              change
            </button>
          </div>
          {/* Show custom config when active */}
          {currentName === "custom" && config.endpointUrl && (
            <div className="mt-1.5 space-y-0.5">
              <p className="font-mono text-[10px] text-muted-foreground/60 truncate">{config.endpointUrl}</p>
              {config.model && <p className="font-mono text-[10px] text-muted-foreground/40">{config.model}</p>}
            </div>
          )}
        </div>
      )}

      {/* Key management */}
      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${hasKey ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
            <span className="text-[10px] text-muted-foreground">
              {hasKey ? "Key stored (encrypted)" : "No key — using env var fallback"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasKey && (
              <button onClick={handleClearKey} disabled={keyPending} className="text-[10px] text-muted-foreground/50 hover:text-red-400 disabled:opacity-40">
                clear
              </button>
            )}
            <button onClick={() => setShowKeyInput((v) => !v)} className="text-[10px] text-muted-foreground/50 hover:text-primary">
              {showKeyInput ? "cancel" : hasKey ? "rotate" : "set key"}
            </button>
          </div>
        </div>

        {showKeyInput && (
          <div className="mt-2 space-y-2">
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="Paste API key or connection string…"
              className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground placeholder-muted-foreground/40 outline-none focus:border-primary/50"
            />
            <button
              onClick={handleSaveKey}
              disabled={keyPending || !keyValue.trim()}
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40"
            >
              {keyPending ? "Encrypting…" : "Save key"}
            </button>
          </div>
        )}
        {keyStatus === "saved" && <p className="mt-1 text-[10px] text-emerald-400">Key encrypted and saved.</p>}
        {keyStatus === "error" && <p className="mt-1 text-[10px] text-red-400">Failed to save key.</p>}
      </div>

      {/* Request new provider */}
      <div className="mt-3 border-t border-border pt-3">
        {!showRequestForm ? (
          <button
            onClick={() => setShowRequestForm(true)}
            className="text-[10px] text-muted-foreground/40 hover:text-primary transition-colors"
          >
            + Request new {label.toLowerCase()} provider
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Request new provider</p>
            {type === "ai" && (
              <p className="text-[10px] text-muted-foreground/60">
                For OpenAI-compatible endpoints, use the <strong className="text-primary">custom</strong> option above — no request needed.
              </p>
            )}
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder={`Provider name (e.g. ${type === "ai" ? "AWS Bedrock" : type === "crawl" ? "Apify" : type === "queue" ? "RabbitMQ" : type === "storage" ? "Cloudflare R2" : "SendGrid"})`}
              className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/40 outline-none focus:border-primary/50"
            />
            <textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              rows={2}
              placeholder="Why do you need this provider?"
              className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/40 outline-none focus:border-primary/50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitRequest}
                disabled={requestPending || !requestName.trim()}
                className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40"
              >
                {requestPending ? "Submitting…" : "Submit Request"}
              </button>
              <button
                onClick={() => { setShowRequestForm(false); setRequestStatus("idle"); }}
                className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
            {requestStatus === "sent" && <p className="text-[10px] text-emerald-400">Request submitted — admin will review it.</p>}
            {requestStatus === "error" && <p className="text-[10px] text-red-400">Failed to submit. Try again.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
