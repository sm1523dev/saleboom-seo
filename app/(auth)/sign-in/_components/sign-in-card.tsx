"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithCredentials, signInWithProvider } from "../actions";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  "microsoft-entra-id": "Microsoft",
  facebook: "Facebook",
};

type Props = {
  socialProviders: string[];
};

export function SignInCard({ socialProviders }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="w-full"
    >
      <div className="card-glow glass rounded-2xl border border-border p-8">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back to SaleBoom SEO
          </p>
        </div>

        <form action={signInWithCredentials} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="input-glow"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="input-glow"
            />
          </div>
          <Button type="submit" className="btn-press w-full" aria-label="Sign in">
            Sign in
          </Button>
        </form>

        {socialProviders.length > 0 && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or continue with</span>
              </div>
            </div>

            <div className="space-y-2">
              {socialProviders.map((provider) => (
                <form key={provider} action={signInWithProvider.bind(null, provider)}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="btn-press w-full border-border bg-secondary/50 text-foreground hover:bg-secondary"
                    aria-label={`Sign in with ${PROVIDER_LABELS[provider] ?? provider}`}
                  >
                    {PROVIDER_LABELS[provider] ?? provider}
                  </Button>
                </form>
              ))}
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
