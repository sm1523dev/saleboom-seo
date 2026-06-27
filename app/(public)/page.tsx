import type { Metadata } from "next";
import { HeroSection } from "./_components/hero-section";
import { FeatureSections } from "./_components/feature-sections";

export const metadata: Metadata = {
  title: "AI SEO & AEO Optimization — Automated Audits in 60 Seconds",
  description:
    "SaleBoom SEO audits your website for SEO and Answer Engine Optimization (AEO) in under 60 seconds. Get cited by ChatGPT, Perplexity, and Gemini.",
  openGraph: {
    title: "SaleBoom SEO — AI-powered SEO & AEO Platform",
    description:
      "Automated SEO and AEO optimization. Enter your URL and get a full audit in under 60 seconds.",
    type: "website",
    siteName: "SaleBoom SEO",
  },
  twitter: {
    card: "summary_large_image",
    title: "SaleBoom SEO — AI-powered SEO & AEO Platform",
    description:
      "Automated SEO and AEO optimization. Enter your URL and get a full audit in under 60 seconds.",
  },
  alternates: {
    canonical: "https://saleboom.com",
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <FeatureSections />
    </main>
  );
}
