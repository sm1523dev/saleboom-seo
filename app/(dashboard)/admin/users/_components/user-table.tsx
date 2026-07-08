"use client";

import { useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  promoteToAdmin,
  demoteFromAdmin,
  deactivateUser,
  reactivateUser,
} from "@/app/actions/admin.actions";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  createdAt: Date;
  deletedAt: Date | null;
};

interface UserTableProps {
  users: User[];
  currentUserId: string;
}

function AvatarInitial({ name, email }: { name: string | null; email: string }) {
  const initial = (name ?? email).charAt(0).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
      {initial}
    </div>
  );
}

function RoleBadge({ role }: { role: "admin" | "user" }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      user
    </span>
  );
}

function StatusBadge({ deletedAt }: { deletedAt: Date | null }) {
  if (deletedAt) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
        Deactivated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
      Active
    </span>
  );
}

function ActionButton({
  onClick,
  disabled,
  isPending,
  variant,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  isPending: boolean;
  variant: "promote" | "demote" | "deactivate" | "reactivate";
  children: React.ReactNode;
}) {
  const variantClasses: Record<typeof variant, string> = {
    promote:
      "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50",
    demote:
      "border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
    deactivate:
      "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50",
    reactivate:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className={[
        "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variantClasses[variant],
      ].join(" ")}
    >
      {isPending ? "…" : children}
    </button>
  );
}

function UserRow({
  user,
  isSelf,
}: {
  user: User;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleAction(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) {
        // Surface errors without crashing — no toast library assumed
        // eslint-disable-next-line no-console
        console.error("[admin]", result.error);
      }
    });
  }

  const joined = new Date(user.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center gap-4 px-5 py-4"
    >
      {/* Avatar */}
      <AvatarInitial name={user.name} email={user.email} />

      {/* Name / Email */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {user.name ?? user.email}
          </span>
          {isSelf && (
            <span className="shrink-0 text-xs text-muted-foreground">(you)</span>
          )}
        </div>
        {user.name && (
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        )}
      </div>

      {/* Role */}
      <div className="hidden w-20 sm:block">
        <RoleBadge role={user.role} />
      </div>

      {/* Joined */}
      <div className="hidden w-28 shrink-0 text-xs text-muted-foreground lg:block">
        {joined}
      </div>

      {/* Status */}
      <div className="hidden w-28 shrink-0 sm:block">
        <StatusBadge deletedAt={user.deletedAt} />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {user.role === "admin" ? (
          <ActionButton
            variant="demote"
            onClick={() => handleAction(() => demoteFromAdmin(user.id))}
            disabled={isSelf}
            isPending={isPending}
          >
            Demote
          </ActionButton>
        ) : (
          <ActionButton
            variant="promote"
            onClick={() => handleAction(() => promoteToAdmin(user.id))}
            disabled={isSelf}
            isPending={isPending}
          >
            Make Admin
          </ActionButton>
        )}

        {user.deletedAt ? (
          <ActionButton
            variant="reactivate"
            onClick={() => handleAction(() => reactivateUser(user.id))}
            disabled={false}
            isPending={isPending}
          >
            Reactivate
          </ActionButton>
        ) : (
          <ActionButton
            variant="deactivate"
            onClick={() => handleAction(() => deactivateUser(user.id))}
            disabled={isSelf}
            isPending={isPending}
          >
            Deactivate
          </ActionButton>
        )}
      </div>
    </motion.div>
  );
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No users found.</p>
      </div>
    );
  }

  return (
    <div className="card-glow overflow-hidden rounded-xl border border-border bg-card">
      {/* Header row */}
      <div className="flex items-center gap-4 border-b border-border px-5 py-3">
        <div className="h-8 w-8 shrink-0" />
        <span className="flex-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          User
        </span>
        <span className="hidden w-20 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">
          Role
        </span>
        <span className="hidden w-28 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:block">
          Joined
        </span>
        <span className="hidden w-28 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">
          Status
        </span>
        <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </span>
      </div>

      {/* User rows */}
      <div className="divide-y divide-border">
        <AnimatePresence initial={false}>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
