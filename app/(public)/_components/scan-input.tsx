"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ScanInput() {
  const [url, setUrl] = useState("");

  return (
    <div className="flex gap-2">
      <label htmlFor="website-url" className="sr-only">
        Website URL to scan
      </label>
      <Input
        id="website-url"
        type="url"
        placeholder="https://yourwebsite.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="input-glow flex-1 border-border bg-card text-foreground placeholder:text-muted-foreground"
        aria-label="Website URL to scan"
        autoComplete="url"
      />
      <Button
        type="button"
        disabled={!url}
        aria-label="Start SEO scan"
        className="btn-press bg-primary px-5 text-primary-foreground hover:bg-primary/90"
      >
        Scan →
      </Button>
    </div>
  );
}
