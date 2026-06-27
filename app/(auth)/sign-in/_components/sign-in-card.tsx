"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInCard() {
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
            Sign in to your SaleBoom SEO account
          </p>
        </div>

        <form className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              className="input-glow border-border bg-secondary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="input-glow border-border bg-secondary/50"
            />
          </div>

          <Button
            type="submit"
            className="btn-press w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="btn-press w-full border-border bg-secondary/50 text-foreground hover:bg-secondary"
          aria-label="Continue with Microsoft account"
        >
          Continue with Microsoft
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Authentication via Auth.js — wired in SALEB-26
        </p>
      </div>
    </motion.div>
  );
}
