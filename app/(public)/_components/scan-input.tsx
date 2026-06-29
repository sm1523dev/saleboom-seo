"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ScanInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    // Authenticated users are sent to the dashboard scan page with URL pre-filled.
    // The proxy.ts middleware will redirect unauthenticated users to sign-in first.
    const encoded = encodeURIComponent(url.trim());
    router.push(`/scan?url=${encoded}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2" aria-label="Start a website scan">
      <label htmlFor="website-url" className="sr-only">
        Website URL to scan
      </label>
      <Input
        id="website-url"
        name="url"
        type="url"
        placeholder="https://yourwebsite.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="input-glow flex-1 border-border bg-card text-foreground placeholder:text-muted-foreground"
        aria-label="Website URL to scan"
        autoComplete="url"
      />
      <Button
        type="submit"
        disabled={!url.trim()}
        aria-label="Start SEO scan"
        className="btn-press bg-primary px-5 text-primary-foreground hover:bg-primary/90"
      >
        Scan →
      </Button>
    </form>
  );
}
