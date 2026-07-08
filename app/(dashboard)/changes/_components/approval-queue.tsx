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
  websiteName: string | null;
  websiteUrl: string | null;
  isCmsConnected: boolean;
};

type ItemState = "pending" | "pushing" | "pushed" | "rejected" | "error";

type Props = { items: QueueItem[] };

export function ApprovalQueue({ items }: Props) {
  const router = useRouter();
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSavingEdit, startEditTransition] = useTransition();
  const [pushingGroup, startGroupTransition] = useTransition();

  function setItemState(id: string, state: ItemState) {
    setItemStates((prev) => ({ ...prev, [id]: state }));
  }

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(ids: string[]) {
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handlePush(id: string) {
    setItemState(id, "pushing");
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
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
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  function handleBulkPush(ids: string[]) {
    const pushable = ids.filter((id) => {
      const item = items.find((i) => i.id === id);
      return item?.isCmsConnected && !itemStates[id];
    });
    startGroupTransition(async () => {
      await Promise.allSettled(pushable.map((id) => handlePush(id)));
      setSelected((prev) => { const n = new Set(prev); pushable.forEach((id) => n.delete(id)); return n; });
      router.refresh();
    });
  }

  // Group items by websiteId
  const groups = new Map<string | null, QueueItem[]>();
  for (const item of items) {
    const key = item.websiteId ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const activeItems = items.filter((i) => !["pushed", "rejected"].includes(itemStates[i.id] ?? ""));

  if (items.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No fixes waiting to push.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Go to a scan's{" "}
          <Link href="/scan" className="text-primary hover:underline">Full Audit</Link>
          {" "}and click "Fix all quick fixes" to generate AI fixes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-semibold">Edit value</h3>
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <p className="mt-1 text-right font-mono text-xs text-muted-foreground">{editValue.length} chars</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="button" disabled={isSavingEdit || !editValue.trim()}
                onClick={() => startEditTransition(async () => {
                  await editChangeAfterValue(editingId, editValue);
                  setEditingId(null);
                  router.refresh();
                })}
                className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {isSavingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Per-website groups */}
      {[...groups.entries()].map(([websiteKey, groupItems]) => {
        const first = groupItems[0];
        const websiteName = first.websiteName ?? first.websiteUrl ?? "Unknown site";
        const websiteId = first.websiteId;
        const isCmsConnected = first.isCmsConnected;
        const activeGroupItems = groupItems.filter((i) => !["pushed", "rejected"].includes(itemStates[i.id] ?? ""));
        const groupIds = activeGroupItems.map((i) => i.id);
        const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id));
        const selectedInGroup = groupIds.filter((id) => selected.has(id));
        const pushableSelected = selectedInGroup.filter((id) => !itemStates[id]);

        return (
          <div key={websiteKey} className="space-y-3">
            {/* Website header */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="rounded" checked={allGroupSelected}
                  onChange={() => toggleGroup(groupIds)}
                  aria-label={`Select all items for ${websiteName}`} />
                <div>
                  <p className="text-sm font-semibold">{websiteName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{first.websiteUrl ?? ""}</p>
                </div>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                  {activeGroupItems.length} pending
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isCmsConnected && websiteId && (
                  <Link href={`/website/${websiteId}/cms`}
                    className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-400 hover:bg-yellow-500/10">
                    Connect CMS
                  </Link>
                )}
                {isCmsConnected && (
                  <button type="button" disabled={pushableSelected.length === 0 || pushingGroup}
                    onClick={() => handleBulkPush(pushableSelected.length > 0 ? pushableSelected : groupIds)}
                    className="btn-press rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {pushingGroup ? "Pushing…"
                      : pushableSelected.length > 0
                        ? `Push ${pushableSelected.length} selected`
                        : `Push all ${activeGroupItems.length}`}
                  </button>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2 pl-4">
              {groupItems.map((item) => {
                const state = itemStates[item.id] ?? "pending";
                const isPushing = state === "pushing";
                const isDone = state === "pushed" || state === "rejected";

                return (
                  <AnimatePresence key={item.id}>
                    {!isDone && (
                      <motion.div layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "rounded-xl border bg-card p-4 transition-colors",
                          state === "error" ? "border-red-500/30" : "border-border",
                          selected.has(item.id) && "border-primary/40 bg-primary/5",
                        )}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" className="mt-0.5 rounded"
                            checked={selected.has(item.id)}
                            onChange={() => toggleItem(item.id)}
                            aria-label={`Select ${item.pageUrl}`} />
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
                                  {item.beforeValue
                                    ? item.beforeValue
                                    : <em className="opacity-50 text-xs">Not set (was missing)</em>}
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-primary">AI fix</p>
                                <div className="min-h-[2rem] rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                                  {item.afterValue}
                                </div>
                              </div>
                            </div>
                            {state === "error" && errors[item.id] && (
                              <p className="mt-2 text-xs text-red-400">{errors[item.id]}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5">
                            {item.isCmsConnected && (
                              <button type="button" onClick={() => handlePush(item.id)} disabled={isPushing}
                                className="btn-press rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                {isPushing ? "Pushing…" : "Push"}
                              </button>
                            )}
                            <button type="button"
                              onClick={() => { setEditingId(item.id); setEditValue(item.afterValue); }}
                              disabled={isPushing}
                              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                              Edit
                            </button>
                            <button type="button" onClick={() => handleReject(item.id)} disabled={isPushing}
                              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
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
          </div>
        );
      })}
    </div>
  );
}
