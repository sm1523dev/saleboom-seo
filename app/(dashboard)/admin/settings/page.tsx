import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-utils";
import { getSystemSettings } from "@/app/actions/system-settings.actions";
import { SETTINGS_KEYS } from "@/lib/settings-keys";
import { SettingsForm } from "./_components/settings-form";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSystemSettings();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide configuration managed by admins.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">
          Notifications
        </h2>
        <SettingsForm
          slackWebhook={settings[SETTINGS_KEYS.SLACK_WEBHOOK] ?? ""}
          supportEmail={settings[SETTINGS_KEYS.SUPPORT_EMAIL] ?? ""}
          responseWindow={settings[SETTINGS_KEYS.RESPONSE_WINDOW] ?? "24-72 hours"}
        />
      </section>
    </div>
  );
}
