"use client";

import { useState, useTransition } from "react";
import {
  addNotificationChannel,
  removeNotificationChannel,
  toggleNotificationChannel,
} from "@/app/actions/notification-channels.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Channel = {
  id: string;
  channelType: "email" | "slack" | "whatsapp";
  name: string;
  provider: string;
  config: Record<string, string>;
  enabled: boolean;
};

type ChannelType = "slack" | "email";
type EmailProvider = "smtp" | "resend" | "sendgrid";

const CHANNEL_ICON: Record<string, string> = {
  email: "✉",
  slack: "#",
  whatsapp: "◎",
};

export function NotificationChannels({ channels: initial }: { channels: Channel[] }) {
  const [channels, setChannels] = useState(initial);
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [channelType, setChannelType] = useState<ChannelType>("slack");
  const [emailProvider, setEmailProvider] = useState<EmailProvider>("smtp");
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");

  function resetForm() {
    setChannelType("slack");
    setEmailProvider("smtp");
    setLabel("");
    setKey("");
    setSecret("");
    setTo("");
    setFrom("");
    setSmtpHost("smtp.gmail.com");
    setSmtpPort("587");
    setError(null);
    setIsAdding(false);
  }

  function handleAdd() {
    if (!label.trim() || !key.trim()) {
      setError("Label and primary credential are required.");
      return;
    }
    if (channelType === "email" && !to.trim()) {
      setError("Recipient address is required for email channels.");
      return;
    }

    const config: Record<string, string> = {};
    if (channelType === "email") {
      config.to = to.trim();
      if (from.trim()) config.from = from.trim();
      if (emailProvider === "smtp") {
        config.host = smtpHost.trim();
        config.port = smtpPort.trim();
        config.user = key.trim();
      }
    }

    startTransition(async () => {
      const res = await addNotificationChannel({
        channelType,
        name: label.trim(),
        provider: channelType === "slack" ? "incoming-webhook" : emailProvider,
        key,
        secret: channelType === "email" && emailProvider === "smtp" ? secret : undefined,
        config,
      });
      if (!res.success) {
        setError(res.error ?? "Failed to add channel.");
        return;
      }
      // Optimistic append with a temp id — page revalidation will replace it
      setChannels((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          channelType,
          name: label.trim(),
          provider: channelType === "slack" ? "incoming-webhook" : emailProvider,
          config,
          enabled: true,
        },
      ]);
      resetForm();
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, enabled } : ch)),
    );
    startTransition(async () => {
      await toggleNotificationChannel(id, enabled);
    });
  }

  function handleRemove(id: string) {
    setChannels((prev) => prev.filter((ch) => ch.id !== id));
    startTransition(async () => {
      await removeNotificationChannel(id);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Alert Channels</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Email, Slack, and more — credentials encrypted at rest.
          </p>
        </div>
        {!isAdding && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs btn-press"
            onClick={() => setIsAdding(true)}
          >
            + Add channel
          </Button>
        )}
      </div>

      {/* Existing channels */}
      {channels.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {channels.map((ch) => (
            <li key={ch.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 text-center font-mono text-sm text-muted-foreground select-none">
                {CHANNEL_ICON[ch.channelType] ?? "○"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ch.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {ch.provider}
                  {ch.config.to ? ` · ${ch.config.to}` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  ch.channelType === "slack"
                    ? "bg-violet-500/10 text-violet-400"
                    : "bg-blue-500/10 text-blue-400",
                )}
              >
                {ch.channelType}
              </span>
              {/* Enable/disable toggle */}
              <button
                type="button"
                aria-label={ch.enabled ? "Disable channel" : "Enable channel"}
                onClick={() => handleToggle(ch.id, !ch.enabled)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  ch.enabled ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
                    ch.enabled ? "left-[18px]" : "left-0.5",
                  )}
                />
              </button>
              <button
                type="button"
                aria-label="Remove channel"
                onClick={() => handleRemove(ch.id)}
                className="text-muted-foreground/40 hover:text-red-400 transition-colors text-base leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {channels.length === 0 && !isAdding && (
        <p className="px-4 py-3 text-[10px] text-muted-foreground border-t border-border">
          No channels — alerts fall back to <code className="font-mono">SLACK_ALERT_WEBHOOK</code> / <code className="font-mono">ALERT_EMAIL_TO</code> env vars.
        </p>
      )}

      {/* Add form */}
      {isAdding && (
        <div className="px-4 py-4 space-y-4 border-t border-border">
          {/* Channel type selector */}
          <div className="flex gap-2">
            {(["slack", "email"] as ChannelType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChannelType(t)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors btn-press",
                  channelType === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {CHANNEL_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. ops-alerts"
              className="input-glow h-8 text-xs"
            />
          </div>

          {/* Slack fields */}
          {channelType === "slack" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Incoming Webhook URL</Label>
              <Input
                type="url"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="input-glow h-8 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Create one at{" "}
                <span className="text-primary">api.slack.com/apps → Incoming Webhooks</span>
              </p>
            </div>
          )}

          {/* Email fields */}
          {channelType === "email" && (
            <div className="space-y-3">
              {/* Provider selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Email Provider</Label>
                <div className="flex gap-2">
                  {(["smtp", "resend", "sendgrid"] as EmailProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEmailProvider(p)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors btn-press",
                        emailProvider === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {emailProvider === "smtp" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">SMTP User</Label>
                      <Input
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="you@gmail.com"
                        className="input-glow h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">App Password</Label>
                      <Input
                        type="password"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        placeholder="Gmail app password"
                        className="input-glow h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">SMTP Host</Label>
                      <Input
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="input-glow h-8 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Port</Label>
                      <Input
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        className="input-glow h-8 font-mono text-xs w-20"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <Input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={emailProvider === "resend" ? "re_..." : "SG...."}
                    className="input-glow h-8 font-mono text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">From address</Label>
                  <Input
                    type="email"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="alerts@saleboom.com"
                    className="input-glow h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To (recipients)</Label>
                  <Input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="ops@company.com"
                    className="input-glow h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Comma-separated</p>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isPending}
              className="text-xs btn-press"
            >
              {isPending ? "Saving…" : "Add channel"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={resetForm}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
