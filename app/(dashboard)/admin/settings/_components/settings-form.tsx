"use client";

import { useActionState } from "react";
import { saveNotificationSettings } from "@/app/actions/system-settings.actions";
import type { SettingsState } from "@/lib/settings-keys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SettingsForm({
  slackWebhook,
  supportEmail,
  responseWindow,
}: {
  slackWebhook: string;
  supportEmail: string;
  responseWindow: string;
}) {
  const [state, action, isPending] = useActionState<SettingsState, FormData>(
    saveNotificationSettings,
    null,
  );

  return (
    <form action={action} className="card-glow rounded-xl border border-border bg-card p-6 space-y-5 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="slackWebhook">Slack Incoming Webhook URL</Label>
        <Input
          id="slackWebhook"
          name="slackWebhook"
          type="url"
          defaultValue={slackWebhook}
          placeholder="https://hooks.slack.com/services/..."
          className="input-glow font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Connect with us requests and fix notifications will be posted here.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supportEmail">Support Email</Label>
        <Input
          id="supportEmail"
          name="supportEmail"
          type="email"
          defaultValue={supportEmail}
          placeholder="support@saleboom.com"
          className="input-glow"
        />
        <p className="text-xs text-muted-foreground">
          Fallback email when Slack is not configured.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="responseWindow">Response Window</Label>
        <Input
          id="responseWindow"
          name="responseWindow"
          type="text"
          defaultValue={responseWindow}
          placeholder="24-72 hours"
          className="input-glow w-40"
        />
        <p className="text-xs text-muted-foreground">
          Shown to users after they click &ldquo;Connect with us&rdquo;.
        </p>
      </div>

      {state?.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-green-400">{state.success}</p>
      )}

      <Button type="submit" disabled={isPending} className="btn-press">
        {isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
