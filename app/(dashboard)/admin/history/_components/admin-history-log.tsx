"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

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

type ChangeItem = {
  id: string;
  pageUrl: string;
  fieldChanged: string;
  beforeValue: string | null;
  afterValue: string;
  status: string;
  appliedAt: string | null;
  createdAt: string;
};

type UserGroup = {
  userId: string;
  userEmail: string;
  userName: string | null;
  websites: {
    websiteId: string | null;
    websiteName: string | null;
    websiteUrl: string | null;
    totalFixes: number;
    lastApplied: string | null;
    changes: ChangeItem[];
  }[];
};

type Props = {
  groups: UserGroup[];
};

export function AdminHistoryLog({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No change history yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((user) => (
        <UserRow key={user.userId} user={user} />
      ))}
    </div>
  );
}

function UserRow({ user }: { user: UserGroup }) {
  const [expanded, setExpanded] = useState(false);
  const totalFixes = user.websites.reduce((s, w) => s + w.totalFixes, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold">
            {(user.userName ?? user.userEmail).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{user.userName ?? user.userEmail}</p>
            <p className="text-xs text-muted-foreground">{user.userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium">
            {totalFixes} fix{totalFixes !== 1 ? "es" : ""} · {user.websites.length} site{user.websites.length !== 1 ? "s" : ""}
          </span>
          <span className={cn("text-muted-foreground transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true">
            ▾
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-0 divide-y divide-border">
              {user.websites.map((site) => (
                <WebsiteRow key={site.websiteId ?? "unknown"} site={site} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WebsiteRow({ site }: { site: UserGroup["websites"][0] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-2.5 text-left hover:bg-muted/10 transition-colors"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-sm font-medium">{site.websiteName ?? "Unknown website"}</p>
          {site.websiteUrl && (
            <p className="font-mono text-xs text-muted-foreground">{site.websiteUrl}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{site.totalFixes} fix{site.totalFixes !== 1 ? "es" : ""}</span>
          {site.lastApplied && (
            <span>{new Intl.DateTimeFormat("en", { dateStyle: "short" }).format(new Date(site.lastApplied))}</span>
          )}
          <span className={cn("transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true">
            ▾
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-5 pb-3 pt-1">
              {site.changes.map((change) => {
                const statusCfg = STATUS_CONFIG[change.status] ?? STATUS_CONFIG.reverted;
                const ts = change.appliedAt ?? change.createdAt;
                return (
                  <div key={change.id} className="rounded-lg border border-border bg-muted/10 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-medium">
                        {FIELD_LABELS[change.fieldChanged] ?? change.fieldChanged}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5", statusCfg.className)}>
                        {statusCfg.label}
                      </span>
                      <span className="text-muted-foreground">
                        {new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts))}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground" title={change.pageUrl}>
                      {change.pageUrl}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
