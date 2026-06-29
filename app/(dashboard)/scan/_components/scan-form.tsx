"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { startScanAction, type ScanActionState } from "../actions";

export function ScanForm({ defaultUrl }: { defaultUrl?: string }) {
  const [state, formAction, isPending] = useActionState<ScanActionState, FormData>(
    startScanAction,
    null
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-xl"
    >
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="scan-url">Website URL</Label>
          <Input
            id="scan-url"
            name="url"
            type="url"
            defaultValue={defaultUrl}
            placeholder="https://yourwebsite.com"
            required
            autoComplete="url"
            aria-label="Website URL to scan"
            aria-describedby={state?.error ? "scan-url-error" : undefined}
            aria-invalid={!!state?.error}
            className="input-glow h-12 text-base"
          />
          {state?.error && (
            <p
              id="scan-url-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {state.error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          aria-label="Start website SEO scan"
          className="btn-press h-12 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
                aria-hidden="true"
              />
              Starting scan…
            </span>
          ) : (
            "Scan My Website →"
          )}
        </Button>
      </form>
    </motion.div>
  );
}
