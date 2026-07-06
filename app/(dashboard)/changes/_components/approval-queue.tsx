"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { pushChangeTocms, rejectChange, editChangeAfterValue } from "@/app/actions/changes.actions";

const FIELD_LABELS: Record<string, string> = {
  meta_title: "Page Title",
  meta_description: "Page Description",
  h1: "Main Heading",
};

type QueueItem = {
  id: string;
  pageUrl: string;
  fieldChanged: string;
  beforeValue: string | null;
  afterValue: string;
  createdAt: string;
  websiteId: string | null;
  isCmsConnected: boolean;
};

type ItemState = "pending" | "pushing" | "pushed" | "rejected" | "error";

type Props = {
  items: QueueItem[];
  page: number;
  pageSize: number;
};

export function ApprovalQueue({ items, page, pageSize }: Props) {
  const router = useRouter();
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSavingEdit, startEditTransition] = useTransition();
  const [isBulkPending, startBulkTransition] = useTransition();

  function setItemState(id: string, state: ItemState) {
    setItemStates((prev) => ({ ...prev, [id]: state }));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pushable = items.filter((i) => i.isCmsConnected && !itemStates[i.id]);
    if (selected.size === pushable.length) setSelected(new Set());
    else setSelected(new Set(pushable.map((i) => i.id)));
  }

  async function handlePush(id: string) {
    setItemState(id, "pushing");
    setErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    const result = await pushChangeTocms(id);
    if (result.success) {
      setItemState(id, "pushed");
    } else {
      setItemState(id, "error");
      setErrors((prev) => ({ ...prev, [id]: result.error ?? "Push failed" }));
    }
  }

  async function handleReject(id: string) {
    setItemState(id, "pushing");
    await rejectChange(id);
    setItemState(id, "rejected");
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function handleBulkPush() {
    startBulkTransition(async () => {
      await Promise.allSettled(Array.from(selected).map((id) => handlePush(id)));
      setSelected(new Set());
      router.refresh();
    });
  }

  const activeItems = items.filter((i) => !["pushed", "rejected"].includes(itemStates[i.id] ?? "pending"));

  if (items.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No approved changes waiting to push.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Review AI suggestions on your{" "}
          <Link href="/scan" className="text-primary hover:underline">
            scan results
          </Link>{" "}
          page and approve fields to queue them here.
        </p>
      </div>
    );
  }

  const pushableSelected = Array.from(selected).filter((id) => {
    const item = items.find((i) => i.id === id);
    return item?.isCmsConnected && !itemStates[id];
  });

  return (
    <div className="space-y-4">
      {/* Inline edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <h3 className="font-semibold">Edit value</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The edited value will replace the AI suggestion and return to pending status.
            </p>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
            <p className="mt-1 text-right font-mono text-xs text-muted-foreground">{editValue.length} chars</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit || !editValue.trim()}
                onClick={() => startEditTransition(async () => {
                  await editChangeAfterValue(editingId, editValue);
                  setEditingId(null);
                  router.refresh();
                })}
                className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSavingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Bulk actions bar */}
      {activeItems.some((i) => i.isCmsConnected) && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === activeItems.filter((i) => i.isCmsConnected).length}
              onChange={toggleAll}
              className="rounded"
              aria-label="Select all pushable items"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {pushableSelected.length > 0 && (
            <button
              type="button"
              onClick={handleBulkPush}
              disabled={isBulkPending}
              className="btn-press rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isBulkPending ? "Pushing…" : `Push ${pushableSelected.length} to CMS`}
            </button>
          )}
        </div>
      )}

      {/* Queue rows */}
      <div className="space-y-2">
        {items.map((item) => {
          const state = itemStates[item.id] ?? "pending";
          const isPushing = state === "pushing";
          const isDone = state === "pushed" || state === "rejected";

          return (
            <AnimatePresence key={item.id}>
              {!isDone && (
                <motion.div
                  layout
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "rounded-xl border bg-card p-4 transition-colors",
                    state === "error" ? "border-red-500/30" : "border-border",
                    selected.has(item.id) && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {item.isCmsConnected && state === "pending" && (
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-0.5 rounded"
                        aria-label={`Select ${item.pageUrl}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium">
                          {FIELD_LABELS[item.fieldChanged] ?? item.fieldChanged}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">{item.pageUrl}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">Current</p>
                          <div className="min-h-[2rem] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                            {item.beforeValue ?? <em className="opacity-50">Not set</em>}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-primary">Approved suggestion</p>
                          <div className="min-h-[2rem] rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                            {item.afterValue}
                          </div>
                        </div>
                      </div>

                      {state === "error" && errors[item.id] && (
                        <p className="mt-2 text-xs text-red-400">{errors[item.id]}</p>
                      )}

                      {!item.isCmsConnected && (
                        <p className="mt-2 text-xs text-yellow-500/80">
                          CMS not connected —{" "}
                          {item.websiteId ? (
                            <Link href={`/website/${item.websiteId}/cms`} className="underline hover:text-yellow-400">
                              Connect CMS
                            </Link>
                          ) : (
                            "connect a CMS to push this change"
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-1.5">
                      {item.isCmsConnected && (
                        <button
                          type="button"
                          onClick={() => handlePush(item.id)}
                          disabled={isPushing}
                          className="btn-press rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isPushing ? "Pushing…" : "Push to CMS"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditingId(item.id); setEditValue(item.afterValue); }}
                        disabled={isPushing}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(item.id)}
                        disabled={isPushing}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`/changes?page=${page - 1}`} className="hover:text-foreground">
              ← Previous
            </Link>
          )}
          {items.length === pageSize && (
            <Link href={`/changes?page=${page + 1}`} className="hover:text-foreground">
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
