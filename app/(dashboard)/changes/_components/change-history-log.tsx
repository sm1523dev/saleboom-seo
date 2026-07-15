"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { rollbackChange, verifyChange } from "@/app/actions/changes.actions";
import { VERIFY_ERROR_LABELS } from "@/lib/cms/verify";
import type { VerifyError } from "@/lib/cms/verify";

const FIELD_LABELS: Record<string, string> = {
  meta_title: "Page Title",
  meta_description: "Page Description",
  h1: "Main Heading",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  applied: { label: "Applied", className: "border-green-500/30 bg-green-500/10 text-green-400" },
  rolled_back: { label: "Rolled back", className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" },
  failed: { label: "Failed", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  reverted: { label: "Rejected", className: "border-border bg-muted/40 text-muted-foreground" },
};

type HistoryItem = {
  id: string;
  pageUrl: string;
  fieldChanged: string;
  beforeValue: string | null;
  afterValue: string;
  status: string;
  cmsType: string;
  appliedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  verifiedAt: string | null;
  liveValue: string | null;
  verifyError: string | null;
};

type Props = {
  items: HistoryItem[];
  page: number;
  pageSize: number;
  cmsTypeFilter?: string;
  statusFilter?: string;
};

export function ChangeHistoryLog({ items, page, pageSize, cmsTypeFilter, statusFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rollbackStates, setRollbackStates] = useState<Record<string, "idle" | "rolling" | "done" | "error">>({});
  const [rollbackErrors, setRollbackErrors] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isRollingBack, startRollbackTransition] = useTransition();
  const [verifyStates, setVerifyStates] = useState<Record<string, "idle" | "checking" | "done">>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, { matched: boolean; liveValue: string | null; error: string | null }>>({});
  const [, startVerifyTransition] = useTransition();

  function buildHref(params: Record<string, string | undefined>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    return `/changes/history?${p.toString()}`;
  }

  function handleVerify(id: string) {
    setVerifyStates((prev) => ({ ...prev, [id]: "checking" }));
    startVerifyTransition(async () => {
      const result = await verifyChange(id);
      setVerifyStates((prev) => ({ ...prev, [id]: "done" }));
      setVerifyResults((prev) => ({ ...prev, [id]: result }));
    });
  }

  function handleRollback(id: string) {
    setConfirmId(id);
  }

  function confirmRollback() {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    setRollbackStates((prev) => ({ ...prev, [id]: "rolling" }));
    startRollbackTransition(async () => {
      const result = await rollbackChange(id);
      if (result.success) {
        setRollbackStates((prev) => ({ ...prev, [id]: "done" }));
        router.refresh();
      } else {
        setRollbackStates((prev) => ({ ...prev, [id]: "error" }));
        setRollbackErrors((prev) => ({ ...prev, [id]: result.error ?? "Rollback failed" }));
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No change history yet.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Changes appear here after they are pushed to your CMS from the{" "}
          <Link href="/changes" className="text-primary hover:underline">
            approval queue
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Confirm rollback dialog */}
      <AnimatePresence>
        {confirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <h3 className="font-semibold">Rollback this change?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The original value will be restored on your live site. This cannot be undone.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRollback}
                  disabled={isRollingBack}
                  className="btn-press flex-1 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
                >
                  {isRollingBack ? "Rolling back…" : "Rollback"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Status:</span>
          {[undefined, "applied", "rolled_back"].map((s) => (
            <Link
              key={s ?? "all"}
              href={buildHref({ status: s })}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs transition-colors",
                statusFilter === s
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s ?? "All"}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">CMS:</span>
          {[undefined, "wordpress", "shopify", "webflow"].map((c) => (
            <Link
              key={c ?? "all"}
              href={buildHref({ cmsType: c })}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs capitalize transition-colors",
                cmsTypeFilter === c
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c ?? "All"}
            </Link>
          ))}
        </div>
      </div>

      {/* Log rows */}
      <div className="space-y-2">
        {items.map((item) => {
          const rbState = rollbackStates[item.id] ?? "idle";
          const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.reverted;
          const timestamp = item.appliedAt ?? item.createdAt;
          const isVerifiable = item.status === "applied" || item.status === "rolled_back";
          const vState = verifyStates[item.id] ?? "idle";
          // Merge DB-stored result with in-session result (session wins)
          const vResult = verifyResults[item.id] ?? (item.verifiedAt
            ? { matched: !item.verifyError, liveValue: item.liveValue, error: item.verifyError }
            : null);

          return (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/10">
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium">
                    {FIELD_LABELS[item.fieldChanged] ?? item.fieldChanged}
                  </span>
                  <span className="text-xs capitalize text-muted-foreground">{item.cmsType}</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs", statusCfg.className)}>
                    {statusCfg.label}
                  </span>
                  {/* Verification badge */}
                  {vResult && (
                    vResult.matched
                      ? <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                          Live ✓
                        </span>
                      : <span title={vResult.error ? (VERIFY_ERROR_LABELS[vResult.error as VerifyError] ?? vResult.error) : undefined}
                          className="cursor-help rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                          Not live ⚠
                        </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isVerifiable && vState === "idle" && !vResult && (
                    <button type="button" onClick={() => handleVerify(item.id)}
                      className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">
                      Verify
                    </button>
                  )}
                  {vState === "checking" && <span className="text-xs text-muted-foreground">Checking live…</span>}
                  {item.status === "applied" && rbState === "idle" && (
                    <button type="button" onClick={() => handleRollback(item.id)}
                      className="rounded-md border border-yellow-500/30 px-2.5 py-1 text-xs text-yellow-400 hover:bg-yellow-500/10">
                      Rollback
                    </button>
                  )}
                  {rbState === "rolling" && <span className="text-xs text-muted-foreground">Rolling back…</span>}
                  {rbState === "done" && <span className="text-xs text-green-400">Done</span>}
                  {rbState === "error" && <span className="text-xs text-red-400">{rollbackErrors[item.id]}</span>}
                </div>
              </div>

              {/* Page URL */}
              <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground" title={item.pageUrl}>
                {item.pageUrl}
              </p>

              {/* Before → After */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Before</p>
                  <div className="min-h-[2rem] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {item.beforeValue
                      ? item.beforeValue
                      : <span className="italic opacity-60">Not set (missing)</span>}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-primary">After (AI fix)</p>
                  <div className="min-h-[2rem] rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                    {item.afterValue}
                  </div>
                </div>
              </div>

              {/* Verification detail — shown when failed */}
              {vResult && !vResult.matched && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                  <p className="text-xs font-medium text-red-400">
                    {vResult.error ? (VERIFY_ERROR_LABELS[vResult.error as VerifyError] ?? vResult.error) : "Verification failed"}
                  </p>
                  {vResult.liveValue && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Live: <span className="font-mono">{vResult.liveValue}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page} · {items.length} records</span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link href={buildHref({ page: String(page - 1) })} className="hover:text-foreground">
              ← Previous
            </Link>
          )}
          {items.length === pageSize && (
            <Link href={buildHref({ page: String(page + 1) })} className="hover:text-foreground">
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
