export const SETTINGS_KEYS = {
  SUPPORT_EMAIL: "notification_support_email",
  RESPONSE_WINDOW: "notification_response_window",
} as const;

export type SettingsState = { error?: string; success?: string } | null;
