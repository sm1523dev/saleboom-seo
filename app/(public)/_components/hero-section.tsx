"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Link from "next/link";
import { ScanInput } from "./scan-input";

gsap.registerPlugin(useGSAP);

const HEADLINE: Array<{ text: string; gradient?: boolean }> = [
  { text: "Your" },
  { text: "AI", gradient: true },
  { text: "SEO" },
  { text: "&" },
  { text: "AEO" },
  { text: "Engine" },
];

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from("[data-hero-badge]", { opacity: 0, y: -10, duration: 0.4 })
          .from("[data-hero-word]", { opacity: 0, y: 20, duration: 0.5, stagger: 0.04 }, "-=0.2")
          .from("[data-hero-subtitle]", { opacity: 0, y: 12, duration: 0.5 }, "-=0.25")
          .from("[data-hero-cta]", { opacity: 0, y: 8, duration: 0.4 }, "-=0.2");
      });
    },
    { scope: heroRef }
  );

  return (
    <section
      ref={heroRef}
      aria-label="Hero"
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 text-center"
    >
      {/* Background */}
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />

      {/* Badge */}
      <div data-hero-badge className="relative z-10">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          aria-label="Product status"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          AI-powered SEO &amp; AEO platform
        </span>
      </div>

      {/* H1 */}
      <div className="relative z-10">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          {HEADLINE.map((word, i) => (
            <span
              key={i}
              data-hero-word
              className="inline-block"
              aria-hidden="false"
            >
              {word.gradient ? (
                <span className="text-gradient">{word.text}</span>
              ) : (
                word.text
              )}
              {i < HEADLINE.length - 1 ? " " : ""}
            </span>
          ))}
        </h1>
      </div>

      {/* Subtitle */}
      <p
        data-hero-subtitle
        className="relative z-10 max-w-md text-lg text-muted-foreground"
      >
        Automated SEO and AEO optimization. Enter your website URL and get a
        full audit in under 60 seconds.
      </p>

      {/* CTA */}
      <div data-hero-cta className="relative z-10 flex w-full max-w-md flex-col gap-3">
        <ScanInput />
        <Link
          href="/sign-in"
          className="text-sm text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
        >
          Sign in to your account
        </Link>
      </div>
    </section>
  );
}
