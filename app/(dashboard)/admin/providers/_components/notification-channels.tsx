"use client";

import { useState, useTransition } from "react";
import {
  addNotificationChannel,
  updateNotificationChannel,
  removeNotificationChannel,
  toggleNotificationChannel,
} from "@/app/actions/notification-channels.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
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

type SheetMode = null | "add" | Channel;

const CHANNEL_ICON: Record<string, string> = {
  email: "✉",
  slack: "#",
  whatsapp: "◎",
};

type FormState = {
  channelType: ChannelType;
  emailProvider: EmailProvider;
  label: string;
  key: string;
  secret: string;
  smtpHost: string;
  smtpPort: string;
};

function emptyForm(): FormState {
  return {
    channelType: "slack",
    emailProvider: "smtp",
    label: "",
    key: "",
    secret: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
  };
}

function formFromChannel(ch: Channel): FormState {
  return {
    channelType: ch.channelType === "whatsapp" ? "slack" : (ch.channelType as ChannelType),
    emailProvider: ch.channelType === "email" ? (ch.provider as EmailProvider) : "smtp",
    label: ch.name,
    key: "",
    secret: "",
    smtpHost: ch.config.host ?? "smtp.gmail.com",
    smtpPort: ch.config.port ?? "587",
  };
}

export function NotificationChannels({ channels: initial }: { channels: Channel[] }) {
  const [channels, setChannels] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  function openAdd() {
    setForm(emptyForm());
    setError(null);
    setSheetMode("add");
  }

  function openEdit(ch: Channel) {
    setForm(formFromChannel(ch));
    setError(null);
    setSheetMode(ch);
  }

  function closeSheet() {
    setSheetMode(null);
    setError(null);
  }

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  const isEditing = sheetMode !== null && sheetMode !== "add";

  function handleSubmit() {
    if (!form.label.trim()) { setError("Label is required."); return; }
    if (sheetMode === "add" && !form.key.trim()) { setError("Credential is required."); return; }

    const config: Record<string, string> = {};
    if (form.channelType === "email") {
      if (form.emailProvider === "smtp") {
        config.host = form.smtpHost.trim();
        config.port = form.smtpPort.trim();
        if (form.key.trim()) config.user = form.key.trim();
      }
    }

    const mode = sheetMode;
    startTransition(async () => {
      if (mode === "add") {
        const res = await addNotificationChannel({
          channelType: form.channelType,
          name: form.label.trim(),
          provider: form.channelType === "slack" ? "incoming-webhook" : form.emailProvider,
          key: form.key.trim(),
          secret: form.channelType === "email" && form.emailProvider === "smtp" ? form.secret : undefined,
          config,
        });
        if (!res.success) { setError(res.error ?? "Failed to add channel."); return; }
        setChannels((prev) => [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            channelType: form.channelType,
            name: form.label.trim(),
            provider: form.channelType === "slack" ? "incoming-webhook" : form.emailProvider,
            config,
            enabled: true,
          },
        ]);
      } else if (mode !== null) {
        const res = await updateNotificationChannel(mode.id, {
          name: form.label.trim(),
          config,
          ...(form.key.trim()
            ? {
                key: form.key.trim(),
                secret: form.channelType === "email" && form.emailProvider === "smtp" ? form.secret : undefined,
              }
            : {}),
        });
        if (!res.success) { setError(res.error ?? "Failed to update channel."); return; }
        setChannels((prev) =>
          prev.map((ch) => (ch.id === mode.id ? { ...ch, name: form.label.trim(), config } : ch)),
        );
      }
      closeSheet();
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, enabled } : ch)));
    startTransition(async () => { await toggleNotificationChannel(id, enabled); });
  }

  function handleRemove(id: string) {
    setChannels((prev) => prev.filter((ch) => ch.id !== id));
    startTransition(async () => { await removeNotificationChannel(id); });
  }

  return (
    <>
      <div className="card-glow rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-primary">⊡</span>
            <div>
              <p className="text-sm font-semibold">Alert Channels</p>
              <p className="text-[10px] text-muted-foreground">
                Email and Slack — credentials encrypted at rest
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs btn-press" onClick={openAdd}>
            + Add
          </Button>
        </div>

        {/* Channel list */}
        {channels.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {channels.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 shrink-0 text-center font-mono text-sm text-muted-foreground select-none">
                  {CHANNEL_ICON[ch.channelType] ?? "○"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ch.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ch.provider}{ch.config.host ? ` · ${ch.config.host}:${ch.config.port ?? "587"}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    ch.channelType === "slack"
                      ? "bg-violet-500/10 text-violet-400"
                      : "bg-blue-500/10 text-blue-400",
                  )}
                >
                  {ch.channelType}
                </span>
                <button
                  type="button"
                  aria-label={ch.enabled ? "Disable channel" : "Enable channel"}
                  onClick={() => handleToggle(ch.id, !ch.enabled)}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
                  aria-label="Edit channel"
                  onClick={() => openEdit(ch)}
                  className="shrink-0 text-[10px] text-muted-foreground/50 transition-colors hover:text-primary"
                >
                  edit
                </button>
                <button
                  type="button"
                  aria-label="Remove channel"
                  onClick={() => handleRemove(ch.id)}
                  className="shrink-0 text-base leading-none text-muted-foreground/40 transition-colors hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
            No channels — alerts fall back to{" "}
            <code className="font-mono">SLACK_ALERT_WEBHOOK</code> /{" "}
            <code className="font-mono">ALERT_EMAIL_TO</code> env vars.
          </p>
        )}
      </div>

      {/* Add / Edit sheet */}
      <Sheet open={sheetMode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{isEditing ? "Edit Channel" : "Add Channel"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Channel type — only selectable when adding */}
            {!isEditing && (
              <div className="flex gap-2">
                {(["slack", "email"] as ChannelType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patch({ channelType: t })}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors btn-press",
                      form.channelType === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {CHANNEL_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Label */}
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={form.label}
                onChange={(e) => patch({ label: e.target.value })}
                placeholder="e.g. ops-alerts"
                className="input-glow h-8 text-xs"
              />
            </div>

            {/* Slack */}
            {form.channelType === "slack" && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isEditing ? "New Webhook URL (leave blank to keep existing)" : "Incoming Webhook URL"}
                </Label>
                <Input
                  type="url"
                  value={form.key}
                  onChange={(e) => patch({ key: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                  className="input-glow h-8 font-mono text-xs"
                />
                {!isEditing && (
                  <p className="text-[10px] text-muted-foreground">
                    Create one at{" "}
                    <span className="text-primary">api.slack.com/apps → Incoming Webhooks</span>
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            {form.channelType === "email" && (
              <div className="space-y-3">
                {!isEditing && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email Provider</Label>
                    <div className="flex gap-2">
                      {(["smtp", "resend", "sendgrid"] as EmailProvider[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => patch({ emailProvider: p })}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors btn-press",
                            form.emailProvider === p
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {form.emailProvider === "smtp" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">SMTP User</Label>
                        <Input
                          value={form.key}
                          onChange={(e) => patch({ key: e.target.value })}
                          placeholder="you@gmail.com"
                          className="input-glow h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {isEditing ? "App Password (blank to keep)" : "App Password"}
                        </Label>
                        <Input
                          type="password"
                          value={form.secret}
                          onChange={(e) => patch({ secret: e.target.value })}
                          placeholder="Gmail app password"
                          className="input-glow h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">SMTP Host</Label>
                        <Input
                          value={form.smtpHost}
                          onChange={(e) => patch({ smtpHost: e.target.value })}
                          className="input-glow h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Port</Label>
                        <Input
                          value={form.smtpPort}
                          onChange={(e) => patch({ smtpPort: e.target.value })}
                          className="input-glow h-8 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {isEditing ? "API Key (blank to keep existing)" : "API Key"}
                    </Label>
                    <Input
                      type="password"
                      value={form.key}
                      onChange={(e) => patch({ key: e.target.value })}
                      placeholder={form.emailProvider === "resend" ? "re_..." : "SG...."}
                      className="input-glow h-8 font-mono text-xs"
                    />
                  </div>
                )}

              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isPending || !form.label.trim() || (sheetMode === "add" && !form.key.trim())}
                className="text-xs btn-press"
              >
                {isPending
                  ? isEditing ? "Saving…" : "Adding…"
                  : isEditing ? "Save changes" : "Add channel"}
              </Button>
              <SheetClose asChild>
                <Button size="sm" variant="ghost" className="text-xs">
                  Cancel
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
