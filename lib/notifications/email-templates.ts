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

export function scanCompletionTemplate(opts: {
  userName: string | null;
  websiteUrl: string;
  dvsScore: number | null;
  previousScore: number | null;
  issueCounts: { critical: number; high: number; medium: number; low: number };
  scanId: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { dvsScore, previousScore, issueCounts } = opts;
  const totalIssues = issueCounts.critical + issueCounts.high + issueCounts.medium + issueCounts.low;
  const scoreDisplay = dvsScore !== null ? Math.round(dvsScore) : "—";
  const delta = dvsScore !== null && previousScore !== null ? Math.round(dvsScore) - Math.round(previousScore) : null;
  const deltaStr = delta !== null ? (delta >= 0 ? `+${delta}` : `${delta}`) : null;
  const deltaColor = delta !== null ? (delta >= 0 ? "#22c55e" : "#ef4444") : "#9ca3af";
  const reportUrl = `${opts.appUrl}/scan/${opts.scanId}`;
  const name = opts.userName ?? "there";
  return {
    subject: `Scan complete — DVS ${scoreDisplay}${deltaStr ? ` (${deltaStr})` : ""} · ${opts.websiteUrl}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#8b5cf6;margin:0 0 8px">Scan complete</h2>
      <p style="margin:0 0 24px;color:#9ca3af">Hi ${name}, your SEO scan finished.</p>
      <div style="background:#1c1c1e;border:1px solid #27272a;border-radius:8px;padding:20px;margin:0 0 20px">
        <p style="margin:0 0 4px;color:#9ca3af;font-size:12px">DVS SCORE</p>
        <p style="margin:0;font-size:36px;font-weight:bold;color:#8b5cf6">${scoreDisplay}${deltaStr ? `<span style="font-size:16px;color:${deltaColor};margin-left:8px">${deltaStr}</span>` : ""}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">${opts.websiteUrl}</p>
      </div>
      <div style="background:#1c1c1e;border:1px solid #27272a;border-radius:8px;padding:16px;margin:0 0 24px">
        <p style="margin:0 0 12px;color:#9ca3af;font-size:12px">ISSUES FOUND</p>
        ${issueCounts.critical > 0 ? `<p style="margin:0 0 4px"><span style="color:#ef4444">●</span> <span style="color:#e5e7eb">${issueCounts.critical} Critical</span></p>` : ""}
        ${issueCounts.high > 0 ? `<p style="margin:0 0 4px"><span style="color:#f97316">●</span> <span style="color:#e5e7eb">${issueCounts.high} High</span></p>` : ""}
        ${issueCounts.medium > 0 ? `<p style="margin:0 0 4px"><span style="color:#eab308">●</span> <span style="color:#e5e7eb">${issueCounts.medium} Medium</span></p>` : ""}
        ${issueCounts.low > 0 ? `<p style="margin:0 0 4px"><span style="color:#6b7280">●</span> <span style="color:#e5e7eb">${issueCounts.low} Low</span></p>` : ""}
        ${totalIssues === 0 ? `<p style="margin:0;color:#22c55e">No issues found</p>` : ""}
      </div>
      <a href="${reportUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View full report</a>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `Scan complete — DVS ${scoreDisplay}${deltaStr ? ` (${deltaStr})` : ""}\n${opts.websiteUrl}\nCritical: ${issueCounts.critical}, High: ${issueCounts.high}, Medium: ${issueCounts.medium}, Low: ${issueCounts.low}\nReport: ${reportUrl}`,
  };
}

export function aiSuggestionsTemplate(opts: {
  userName: string | null;
  websiteUrl: string;
  suggestionCount: number;
  scanId: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const name = opts.userName ?? "there";
  const suggestUrl = `${opts.appUrl}/scan/${opts.scanId}#suggestions`;
  return {
    subject: `${opts.suggestionCount} AI suggestion${opts.suggestionCount !== 1 ? "s" : ""} ready — ${opts.websiteUrl}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#8b5cf6;margin:0 0 8px">AI suggestions ready</h2>
      <p style="margin:0 0 24px;color:#9ca3af">Hi ${name}, we've generated <strong style="color:#e5e7eb">${opts.suggestionCount} AI-powered SEO suggestion${opts.suggestionCount !== 1 ? "s" : ""}</strong> for ${opts.websiteUrl}.</p>
      <a href="${suggestUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Review suggestions</a>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `${opts.suggestionCount} AI suggestions ready for ${opts.websiteUrl}.\nReview: ${suggestUrl}`,
  };
}

export function resetPasswordConfirmationTemplate(): { subject: string; html: string; text: string } {
  return {
    subject: "Your SaleBoom SEO password has been reset",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#22c55e;margin:0 0 8px">Password reset successfully</h2>
      <p style="margin:0 0 16px;color:#9ca3af">Your SaleBoom SEO password has been changed. You can now sign in with your new password.</p>
      <p style="margin:0 0 16px;color:#9ca3af">If you did not make this change, contact support immediately.</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `Your SaleBoom SEO password has been reset. If you did not do this, contact support immediately.`,
  };
}

export function profileUpdateTemplate(opts: {
  updateType: "name" | "email" | "password";
}): { subject: string; html: string; text: string } {
  const labels: Record<string, { title: string; body: string }> = {
    name: { title: "Name updated", body: "Your display name has been updated." },
    email: { title: "Email address updated", body: "Your email address has been updated. Use your new email to sign in." },
    password: { title: "Password updated", body: "Your SaleBoom SEO password has been changed." },
  };
  const { title, body } = labels[opts.updateType];
  return {
    subject: `SaleBoom SEO — ${title}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#22c55e;margin:0 0 8px">${title}</h2>
      <p style="margin:0 0 16px;color:#9ca3af">${body}</p>
      <p style="margin:0 0 16px;color:#9ca3af">If you did not make this change, contact support immediately.</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `${title}\n${body}\nIf you did not make this change, contact support immediately.`,
  };
}

export function majorFixHelpTemplate(opts: {
  requesterName?: string;
  requesterEmail: string;
  websiteUrl: string;
  issues: string[];
}): { subject: string; html: string; text: string } {
  const count = opts.issues.length;
  const displayName = opts.requesterName ?? opts.requesterEmail;
  const escape = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const issueItems = opts.issues
    .map((title) => `<li style="margin:4px 0;color:#e5e7eb">${escape(title)}</li>`)
    .join("");
  const issueText = opts.issues.map((t) => `• ${t}`).join("\n");
  const subjectIssue = opts.issues[0]?.slice(0, 60) ?? "major fix";
  return {
    subject:
      count === 1
        ? `Major fix help requested — ${subjectIssue}`
        : `${count} major fix help requests — ${opts.websiteUrl}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#8b5cf6;margin:0 0 16px">Major fix help requested</h2>
      <p style="margin:0 0 8px;color:#9ca3af">From: <strong style="color:#e5e7eb">${escape(displayName)}</strong> &lt;${escape(opts.requesterEmail)}&gt;</p>
      <p style="margin:0 0 16px;color:#9ca3af">Website: <strong style="color:#e5e7eb">${escape(opts.websiteUrl)}</strong></p>
      <p style="margin:0 0 8px;color:#9ca3af;font-size:12px">${count} ISSUE${count !== 1 ? "S" : ""}</p>
      <ul style="margin:0;padding-left:16px">${issueItems}</ul>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO — Admin Requests</p>
    </div>`,
    text: `Major fix help requested (${count})\nFrom: ${displayName} <${opts.requesterEmail}>\nWebsite: ${opts.websiteUrl}\n\n${issueText}`,
  };
}

export function contactFormTemplate(opts: {
  name: string;
  email: string;
  message: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `New contact form submission from ${opts.name}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#8b5cf6;margin:0 0 16px">New contact form submission</h2>
      <p style="margin:0 0 8px;color:#9ca3af">From: <strong style="color:#e5e7eb">${opts.name}</strong> &lt;${opts.email}&gt;</p>
      <div style="background:#1c1c1e;border:1px solid #27272a;border-radius:8px;padding:16px;margin:16px 0;color:#e5e7eb;white-space:pre-wrap">${opts.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `New contact from ${opts.name} <${opts.email}>\n\n${opts.message}`,
  };
}

export function competitiveAnalysisTemplate(opts: {
  userName: string | null;
  websiteName: string;
  websiteUrl: string;
  ownMentionRate: number;
  competitorCount: number;
  appUrl: string;
  websiteId: string;
}): { subject: string; html: string; text: string } {
  const name = opts.userName ?? "there";
  const rate = Math.round(opts.ownMentionRate * 100);
  const reportUrl = `${opts.appUrl}/website/${opts.websiteId}/competitors`;
  return {
    subject: `Competitive analysis complete — ${opts.websiteName} mentioned in ${rate}% of queries`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090b;color:#e5e7eb;padding:32px;border-radius:12px">
      <h2 style="color:#8b5cf6;margin:0 0 8px">Competitive analysis complete</h2>
      <p style="margin:0 0 24px;color:#9ca3af">Hi ${name}, your competitive analysis is ready.</p>
      <div style="background:#1c1c1e;border:1px solid #27272a;border-radius:8px;padding:20px;margin:0 0 20px">
        <p style="margin:0 0 4px;color:#9ca3af;font-size:12px">YOUR MENTION RATE</p>
        <p style="margin:0;font-size:36px;font-weight:bold;color:#8b5cf6">${rate}%</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px">${opts.websiteUrl} · compared against ${opts.competitorCount} competitor${opts.competitorCount !== 1 ? "s" : ""}</p>
      </div>
      <a href="${reportUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View full report</a>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px">SaleBoom SEO</p>
    </div>`,
    text: `Competitive analysis complete — ${opts.websiteName} mentioned in ${rate}% of queries.\nCompared against ${opts.competitorCount} competitor(s).\nReport: ${reportUrl}`,
  };
}
