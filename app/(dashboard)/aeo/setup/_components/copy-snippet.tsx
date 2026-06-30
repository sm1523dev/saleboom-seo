"use client";

import { useState } from "react";

type Props = { websiteId: string };

export function CopySnippet({ websiteId }: Props) {
  const [copied, setCopied] = useState(false);

  const snippet = `<script>window.__SB_WEBSITE_ID="${websiteId}";</script>\n<script src="${typeof window !== "undefined" ? window.location.origin : ""}/aeo-tracker.js" defer></script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs text-muted-foreground">
        {snippet}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy tracking snippet to clipboard"
        className="btn-press rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
      >
        {copied ? "Copied!" : "Copy snippet"}
      </button>
    </div>
  );
}
