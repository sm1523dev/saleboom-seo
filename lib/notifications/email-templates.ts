const FIELD_LABELS: Record<string, string> = {
  meta_title: "Page Title",
  meta_description: "Page Description",
  h1: "Main Heading",
};

function fieldLabel(fieldChanged: string): string {
  return FIELD_LABELS[fieldChanged] ?? fieldChanged;
}

export function pushSuccessTemplate(opts: {
  pageUrl: string;
  fieldChanged: string;
  afterValue: string;
}): { subject: string; html: string; text: string } {
  const field = fieldLabel(opts.fieldChanged);
  return {
    subject: `✓ SEO fix applied — ${field}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#8b5cf6;margin:0 0 16px">Fix applied successfully</h2>
      <p style="margin:0 0 8px;color:#9ca3af">Field: <strong style="color:#e5e7eb">${field}</strong></p>
      <p style="margin:0 0 8px;color:#9ca3af">Page: <strong style="color:#e5e7eb">${opts.pageUrl}</strong></p>
      <p style="margin:0 0 16px;color:#9ca3af">New value:</p>
      <div style="background:#1c1c1e;border:1px solid #27272a;border-radius:8px;padding:12px;color:#e5e7eb">${opts.afterValue}</div>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `Fix applied — ${field} on ${opts.pageUrl}\nNew value: ${opts.afterValue}`,
  };
}

export function pushFailureTemplate(opts: {
  pageUrl: string;
  fieldChanged: string;
  error: string;
}): { subject: string; html: string; text: string } {
  const field = fieldLabel(opts.fieldChanged);
  return {
    subject: `⚠ SEO fix failed — ${field}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#ef4444;margin:0 0 16px">Push failed</h2>
      <p style="margin:0 0 8px;color:#9ca3af">Field: <strong style="color:#e5e7eb">${field}</strong></p>
      <p style="margin:0 0 8px;color:#9ca3af">Page: <strong style="color:#e5e7eb">${opts.pageUrl}</strong></p>
      <p style="margin:0 0 8px;color:#9ca3af">Error: <strong style="color:#ef4444">${opts.error}</strong></p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `Push failed — ${field} on ${opts.pageUrl}\nError: ${opts.error}`,
  };
}

export function rollbackTemplate(opts: {
  pageUrl: string;
  fieldChanged: string;
  beforeValue: string | null;
}): { subject: string; html: string; text: string } {
  const field = fieldLabel(opts.fieldChanged);
  const before = opts.beforeValue ?? "Not set";
  return {
    subject: `↩ SEO change rolled back — ${field}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#eab308;margin:0 0 16px">Change rolled back</h2>
      <p style="margin:0 0 8px;color:#9ca3af">Field: <strong style="color:#e5e7eb">${field}</strong></p>
      <p style="margin:0 0 8px;color:#9ca3af">Page: <strong style="color:#e5e7eb">${opts.pageUrl}</strong></p>
      <p style="margin:0 0 16px;color:#9ca3af">Restored to:</p>
      <div style="background:#1c1c1e;border:1px solid #27272a;border-radius:8px;padding:12px;color:#e5e7eb">${before}</div>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `Change rolled back — ${field} on ${opts.pageUrl}\nRestored to: ${before}`,
  };
}

export function digestTemplate(opts: {
  userName: string;
  websites: Array<{
    name: string;
    url: string;
    dvsScore: number | null;
    dvsDelta: number | null;
    openIssues: number;
    topActions: string[];
  }>;
}): { subject: string; html: string; text: string } {
  const rows = opts.websites
    .map((w) => {
      const delta =
        w.dvsDelta !== null
          ? w.dvsDelta >= 0
            ? `+${w.dvsDelta}`
            : `${w.dvsDelta}`
          : "—";
      const actions = w.topActions
        .map((a) => `<li style="margin:4px 0;color:#9ca3af">${a}</li>`)
        .join("");
      return `<div style="border:1px solid #27272a;border-radius:8px;padding:16px;margin:12px 0">
      <p style="margin:0 0 4px;font-weight:bold;color:#e5e7eb">${w.name}</p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px">${w.url}</p>
      <p style="margin:0 0 8px;color:#9ca3af">DVS Score: <strong style="color:#8b5cf6">${w.dvsScore ?? "—"}</strong> (${delta} this week) · ${w.openIssues} open issues</p>
      ${actions ? `<ul style="margin:8px 0;padding-left:16px">${actions}</ul>` : ""}
    </div>`;
    })
    .join("");

  return {
    subject: `Weekly SEO digest — ${new Date().toLocaleDateString("en", { month: "short", day: "numeric" })}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#8b5cf6;margin:0 0 8px">Your weekly SEO digest</h2>
      <p style="margin:0 0 24px;color:#9ca3af">Hi ${opts.userName},</p>
      ${rows}
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO · Unsubscribe</p>
    </div>`,
    text: opts.websites
      .map((w) => `${w.name}: DVS ${w.dvsScore ?? "—"}, ${w.openIssues} issues`)
      .join("\n"),
  };
}
