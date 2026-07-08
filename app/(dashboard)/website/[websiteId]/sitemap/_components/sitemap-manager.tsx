"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { SitemapAnalysis } from "@/app/actions/sitemap.actions";

type Tab = "overview" | "missing" | "orphaned" | "xml";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "missing", label: "Missing Pages" },
  { id: "orphaned", label: "Orphaned" },
  { id: "xml", label: "Generated XML" },
];

type Props = {
  analysis: SitemapAnalysis;
  websiteId: string;
};

export function SitemapManager({ analysis }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(analysis.generatedXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([analysis.generatedXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sitemap.xml";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div
        className="flex gap-1 rounded-lg border border-border bg-muted/30 p-0.5"
        role="tablist"
        aria-label="Sitemap sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.id === "missing" && analysis.inCrawlNotSitemap.length > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                {analysis.inCrawlNotSitemap.length}
              </span>
            )}
            {tab.id === "orphaned" && analysis.inSitemapNotCrawl.length > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                {analysis.inSitemapNotCrawl.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          {activeTab === "overview" && (
            <OverviewTab analysis={analysis} />
          )}
          {activeTab === "missing" && (
            <UrlListTab
              urls={analysis.inCrawlNotSitemap}
              note="These pages were crawled but are not in your sitemap.xml."
              emptyMessage="All crawled pages are present in your sitemap."
              accent="orange"
            />
          )}
          {activeTab === "orphaned" && (
            <UrlListTab
              urls={analysis.inSitemapNotCrawl}
              note="These URLs are in your sitemap but were not found during crawl (possible 404s)."
              emptyMessage="No orphaned URLs — every sitemap entry was reachable during the last crawl."
              accent="yellow"
            />
          )}
          {activeTab === "xml" && (
            <XmlTab
              xml={analysis.generatedXml}
              copied={copied}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Overview tab — stat cards

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "orange" | "yellow" | "default";
}) {
  const valueClass =
    accent === "orange" && value > 0
      ? "text-orange-400"
      : accent === "yellow" && value > 0
        ? "text-yellow-400"
        : "text-foreground";

  return (
    <div className="card-glow flex flex-col gap-1 rounded-xl border border-border bg-card p-5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-3xl font-bold tracking-tight", valueClass)}>
        {value}
      </span>
    </div>
  );
}

function OverviewTab({ analysis }: { analysis: SitemapAnalysis }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total Crawled" value={analysis.crawledUrls.length} />
      <StatCard label="In Sitemap" value={analysis.sitemapUrls.length} />
      <StatCard
        label="Missing from Sitemap"
        value={analysis.inCrawlNotSitemap.length}
        accent="orange"
      />
      <StatCard
        label="Orphaned in Sitemap"
        value={analysis.inSitemapNotCrawl.length}
        accent="yellow"
      />
    </div>
  );
}

// URL list tab — missing or orphaned

function UrlListTab({
  urls,
  note,
  emptyMessage,
  accent,
}: {
  urls: string[];
  note: string;
  emptyMessage: string;
  accent: "orange" | "yellow";
}) {
  const noteClass =
    accent === "orange" ? "text-orange-400/80" : "text-yellow-400/80";

  if (urls.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className={cn("text-xs", noteClass)}>{note}</p>
      <div className="card-glow overflow-hidden rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {urls.map((url) => (
            <li key={url} className="px-4 py-2.5">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Generated XML tab

function XmlTab({
  xml,
  copied,
  onCopy,
  onDownload,
}: {
  xml: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Generated from crawled URLs — ready to deploy as{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            sitemap.xml
          </code>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            className={cn(
              "rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              copied
                ? "border-primary/50 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Copy sitemap XML to clipboard"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onDownload}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97]"
            aria-label="Download sitemap.xml file"
          >
            Download
          </button>
        </div>
      </div>
      <div className="card-glow overflow-hidden rounded-xl border border-border bg-card">
        <pre className="overflow-auto p-4">
          <code className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            {xml}
          </code>
        </pre>
      </div>
    </div>
  );
}
