"use client";

import { useState, useTransition } from "react";
import { forwardRequestToDeveloper, updateRequestStatus } from "@/app/actions/provider-requests.actions";

type Request = {
  id: string;
  type: string;
  providerName: string;
  reason: string | null;
  developerEmail: string | null;
  adminNote: string | null;
  status: "pending" | "in_progress" | "rejected" | "ready";
  createdAt: Date;
  requesterName: string | null;
  requesterEmail: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending:     "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  in_progress: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  rejected:    "border-red-500/30 bg-red-500/10 text-red-400",
  ready:       "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  rejected: "Rejected",
  ready: "Ready",
};

function RequestModal({ request, onClose }: { request: Request; onClose: () => void }) {
  const [devEmail, setDevEmail] = useState(request.developerEmail ?? "");
  const [adminNote, setAdminNote] = useState(request.adminNote ?? "");
  const [rejectNote, setRejectNote] = useState("");
  const [view, setView] = useState<"detail" | "forward" | "reject">("detail");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"forwarded" | "rejected" | "ready" | null>(null);

  function handleForward() {
    startTransition(async () => {
      const res = await forwardRequestToDeveloper(request.id, devEmail, adminNote || undefined);
      if (res.success) setResult("forwarded");
    });
  }

  function handleReject() {
    startTransition(async () => {
      const res = await updateRequestStatus(request.id, "rejected", rejectNote || undefined);
      if (res.success) setResult("rejected");
    });
  }

  function handleReady() {
    startTransition(async () => {
      const res = await updateRequestStatus(request.id, "ready");
      if (res.success) setResult("ready");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card-glow w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{request.type} adapter</p>
            <h2 className="mt-0.5 text-lg font-bold">{request.providerName}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground">✕</button>
        </div>

        {result ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {result === "forwarded" && "Request forwarded. Email sent to developer. Status → In Progress."}
              {result === "rejected" && "Request rejected."}
              {result === "ready" && "Request marked as Ready."}
            </p>
            <button onClick={onClose} className="rounded-md border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
              Close
            </button>
          </div>
        ) : view === "detail" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] text-muted-foreground/60">Requested by</p><p className="mt-0.5">{request.requesterName ?? request.requesterEmail}</p></div>
              <div><p className="text-[10px] text-muted-foreground/60">Date</p><p className="mt-0.5">{new Date(request.createdAt).toLocaleDateString()}</p></div>
              <div><p className="text-[10px] text-muted-foreground/60">Status</p>
                <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[request.status]}`}>
                  {STATUS_LABEL[request.status]}
                </span>
              </div>
              {request.developerEmail && <div><p className="text-[10px] text-muted-foreground/60">Forwarded to</p><p className="mt-0.5 font-mono text-xs">{request.developerEmail}</p></div>}
            </div>
            {request.reason && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground/60">Reason</p>
                <p className="mt-1 text-sm">{request.reason}</p>
              </div>
            )}
            {request.adminNote && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground/60">Admin note</p>
                <p className="mt-1 text-sm">{request.adminNote}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {request.status !== "ready" && request.status !== "rejected" && (
                <button onClick={() => setView("forward")} className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                  Forward to developer
                </button>
              )}
              {request.status === "in_progress" && (
                <button onClick={handleReady} disabled={isPending} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40">
                  {isPending ? "…" : "Mark as Ready"}
                </button>
              )}
              {request.status === "pending" && (
                <button onClick={() => setView("reject")} className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20">
                  Reject
                </button>
              )}
            </div>
          </div>

        ) : view === "forward" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Send this request to a developer. An email will be sent with all details.</p>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Developer email</span>
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="developer@example.com"
                className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Admin note (optional)</span>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder="Priority, deadline, any context…"
                className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={handleForward} disabled={isPending || !devEmail.trim()} className="rounded-md border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40">
                {isPending ? "Sending…" : "Send Request"}
              </button>
              <button onClick={() => setView("detail")} className="rounded-md border border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80">
                Back
              </button>
            </div>
          </div>

        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Reject this request?</p>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Reason (optional)</span>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                placeholder="Why this request is being rejected…"
                className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={isPending} className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40">
                {isPending ? "…" : "Reject"}
              </button>
              <button onClick={() => setView("detail")} className="rounded-md border border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RequestList({ requests }: { requests: Request[] }) {
  const [selected, setSelected] = useState<Request | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "rejected" | "ready">("all");

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (requests.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No provider requests yet.</p>
        <p className="mt-1 text-xs text-muted-foreground/50">
          Requests appear when users submit them from the Providers page.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {(["all", "pending", "in_progress", "rejected", "ready"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === s
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground border border-transparent",
            ].join(" ")}
          >
            {s === "all" ? `All (${requests.length})` : STATUS_LABEL[s]}
            {s === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-glow overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Type</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Provider</th>
              <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 md:table-cell">Requested by</th>
              <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 lg:table-cell">Date</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((req) => (
              <tr key={req.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{req.type}</span>
                </td>
                <td className="px-4 py-3 font-medium">{req.providerName}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {req.requesterName ?? req.requesterEmail}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                  {new Date(req.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[req.status]}`}>
                    {STATUS_LABEL[req.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelected(req)}
                    className="text-xs text-muted-foreground/50 hover:text-primary"
                  >
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <RequestModal request={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
