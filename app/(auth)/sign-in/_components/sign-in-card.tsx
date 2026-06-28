"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { signInWithMicrosoft } from "../actions";

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

        <form action={signInWithMicrosoft}>
          <Button
            type="submit"
            className="btn-press w-full border-border bg-secondary/50 text-foreground hover:bg-secondary"
            aria-label="Sign in with Microsoft account"
          >
            Continue with Microsoft
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
