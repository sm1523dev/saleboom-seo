"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  hasWebsite: boolean;
  hasScan: boolean;
  hasCmsConnected: boolean;
  hasApprovedFix: boolean;
  firstWebsiteId?: string;
};

type Step = {
  label: string;
  description: string;
  href: string;
  done: boolean;
};

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-transparent"
      )}
      aria-hidden="true"
    >
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
        <path
          d="M1 4l2.5 2.5L9 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function OnboardingChecklist({ hasWebsite, hasScan, hasCmsConnected, hasApprovedFix, firstWebsiteId }: Props) {
  if (hasWebsite && hasScan && hasCmsConnected && hasApprovedFix) return null;

  const cmsHref = firstWebsiteId ? `/website/${firstWebsiteId}/cms` : "/scan";

  const steps: Step[] = [
    {
      label: "Connect a website",
      description: "Add your first URL to start tracking visibility.",
      href: "/scan",
      done: hasWebsite,
    },
    {
      label: "Run your first scan",
      description: "Analyze SEO issues and generate your Digital Visibility Score.",
      href: "/scan",
      done: hasScan,
    },
    {
      label: "Connect your CMS",
      description: "Link WordPress, Shopify, or Webflow to push fixes automatically.",
      href: cmsHref,
      done: hasCmsConnected,
    },
    {
      label: "Approve your first fix",
      description: "Review an AI-suggested change and apply it to your site.",
      href: "/changes",
      done: hasApprovedFix,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <aside
      className="card-glow rounded-xl border border-border bg-card p-5"
      aria-label="Onboarding checklist"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Get started</h2>
        <span className="text-xs text-muted-foreground">
          {completedCount} of 4 complete
        </span>
      </div>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckIcon done={step.done} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {step.label}
                </span>
                {!step.done && (
                  <Link
                    href={step.href}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Start →
                  </Link>
                )}
              </div>
              {!step.done && (
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
