"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateNameAction,
  updateEmailAction,
  updatePasswordAction,
  type ProfileActionState,
} from "../actions";

type Props = {
  name: string | null;
  email: string;
  isSocialAccount: boolean;
  socialProvider: string | null;
};

function StatusMessage({ state }: { state: ProfileActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-sm text-green-400">
        {state.success}
      </p>
    );
  }
  return null;
}

export function ProfileForm({ name, email, isSocialAccount, socialProvider }: Props) {
  const [nameState, nameAction, namePending] = useActionState<ProfileActionState, FormData>(
    updateNameAction,
    null
  );
  const [emailState, emailAction, emailPending] = useActionState<ProfileActionState, FormData>(
    updateEmailAction,
    null
  );
  const [passwordState, passwordAction, passwordPending] = useActionState<ProfileActionState, FormData>(
    updatePasswordAction,
    null
  );

  const providerLabel = socialProvider === "microsoft" ? "Microsoft" : "a social account";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-6"
    >
      {/* Name */}
      <section
        aria-labelledby="name-heading"
        className="card-glow rounded-xl border border-border bg-card p-6"
      >
        <h2 id="name-heading" className="mb-4 font-semibold">Display name</h2>
        <form action={nameAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={name ?? ""}
              placeholder="Your name"
              autoComplete="name"
              className="input-glow max-w-sm"
            />
          </div>
          <StatusMessage state={nameState} />
          <Button
            type="submit"
            disabled={namePending}
            className="btn-press bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {namePending ? "Saving…" : "Save name"}
          </Button>
        </form>
      </section>

      {/* Email */}
      <section
        aria-labelledby="email-heading"
        className="card-glow rounded-xl border border-border bg-card p-6"
      >
        <h2 id="email-heading" className="mb-1 font-semibold">Email address</h2>
        {isSocialAccount ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{email}</p>
            <p className="text-xs text-muted-foreground">
              You&apos;re signed in with {providerLabel}. Your email is managed by your {providerLabel} account.
            </p>
          </div>
        ) : (
          <form action={emailAction} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">New email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={email}
                required
                autoComplete="email"
                className="input-glow max-w-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-current-password">Current password</Label>
              <Input
                id="email-current-password"
                name="currentPassword"
                type="password"
                required
                placeholder="Confirm with your current password"
                autoComplete="current-password"
                className="input-glow max-w-sm"
              />
            </div>
            <StatusMessage state={emailState} />
            <Button
              type="submit"
              disabled={emailPending}
              className="btn-press bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {emailPending ? "Saving…" : "Update email"}
            </Button>
          </form>
        )}
      </section>

      {/* Password */}
      <section
        aria-labelledby="password-heading"
        className="card-glow rounded-xl border border-border bg-card p-6"
      >
        <h2 id="password-heading" className="mb-1 font-semibold">Password</h2>
        {isSocialAccount ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in with {providerLabel}. To update your password, visit your {providerLabel} account settings.
          </p>
        ) : (
          <form action={passwordAction} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className="input-glow max-w-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="input-glow max-w-sm"
              />
            </div>
            <StatusMessage state={passwordState} />
            <Button
              type="submit"
              disabled={passwordPending}
              className="btn-press bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {passwordPending ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}
      </section>
    </motion.div>
  );
}
