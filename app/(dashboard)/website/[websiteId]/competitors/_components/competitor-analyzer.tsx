"use client";

import { useTransition, useState } from "react";
import { runCompetitorAnalysis } from "@/app/actions/competitor.actions";
import type { CompetitorResult } from "@/app/actions/competitor.actions";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "done" | "error";

type Props = { websiteId: string };

export function CompetitorAnalyzer({ websiteId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [domains, setDomains] = useState<[string, string, string]>(["", "", ""]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [own, setOwn] = useState<CompetitorResult | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  function handleDomainChange(index: 0 | 1 | 2, value: string) {
    setDomains((prev) => {
      const next: [string, string, string] = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const filled = domains.filter((d) => d.trim().length > 0);
    setPhase("running");
    startTransition(async () => {
      const result = await runCompetitorAnalysis(websiteId, filled);
      if ("error" in result) {
        setErrorMsg(result.error);
        setPhase("error");
        return;
      }
      setOwn(result.own);
      setCompetitors(result.competitors);
      setPhase("done");
    });
  }

  function handleReset() {
    setPhase("idle");
    setOwn(null);
    setCompetitors([]);
    setErrorMsg("");
  }

  if (phase === "running" || isPending) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-16">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Querying AI providers&hellip;</p>
        <p className="text-xs text-muted-foreground">This may take 10&ndash;30 seconds.</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
        <p className="text-sm font-medium text-red-400">Analysis failed</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-4 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase === "done" && own) {
    const allRows = [own, ...competitors];
    const providerNames = own.providers.map((p) => p.name);

    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Domain
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mention Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mentions
                </th>
                {providerNames.map((name) => (
                  <th
                    key={name}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allRows.map((row, i) => {
                const isOwn = i === 0;
                const ratePercent = Math.round(row.mentionRate * 100);
                return (
                  <tr
                    key={row.domain}
                    className={cn(
                      "transition-colors",
                      isOwn
                        ? "border-l-2 border-l-primary bg-primary/5"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{row.domain}</span>
                      {isOwn && (
                        <span className="ml-2 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-mono text-sm font-semibold tabular-nums",
                          ratePercent >= 50
                            ? "text-green-400"
                            : ratePercent >= 25
                              ? "text-yellow-400"
                              : "text-red-400"
                        )}>
                          {ratePercent}%
                        </span>
                        <div className="h-2 w-24 rounded-full bg-muted/30">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${ratePercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.mentionCount}/{row.totalQueries}
                    </td>
                    {row.providers.map((p) => (
                      <td key={p.name} className="px-4 py-3">
                        {p.mentioned ? (
                          <span className="text-green-400">&#10003;</span>
                        ) : (
                          <span className="text-red-400">&#10007;</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Run again
          </button>
        </div>
      </div>
    );
  }

  // Idle — show form
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6">
        <fieldset>
          <legend className="mb-3 text-sm font-medium">
            Competitor domains <span className="text-muted-foreground">(up to 3)</span>
          </legend>
          <div className="space-y-2">
            {([0, 1, 2] as const).map((i) => (
              <input
                key={i}
                type="text"
                placeholder={`e.g. competitor${i + 1}.com`}
                value={domains[i]}
                onChange={(e) => handleDomainChange(i, e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            ))}
          </div>
        </fieldset>
      </div>
      <button
        type="submit"
        className="btn-press rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Run Analysis
      </button>
    </form>
  );
}
