import type { Metadata } from "next";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-utils";
import { CopySnippet } from "./_components/copy-snippet";

export const metadata: Metadata = {
  title: "AEO Setup",
  robots: { index: false, follow: false },
};

export default async function AeoSetupPage() {
  const session = await getServerSession();

  const userWebsites = await db
    .select({ id: websites.id, name: websites.name, url: websites.url })
    .from(websites)
    .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">AEO Setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the tracking snippet to your website to capture real AI referral traffic.
        </p>
      </header>

      {userWebsites.length === 0 ? (
        <div className="card-glow rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No websites connected yet.{" "}
            <a href="/scan" className="text-primary hover:underline">
              Run a scan first →
            </a>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {userWebsites.map((site) => (
            <div key={site.id} className="card-glow rounded-xl border border-border bg-card p-6">
              <p className="text-sm font-medium">{site.name}</p>
              <p className="mb-4 text-xs text-muted-foreground">{site.url}</p>
              <CopySnippet websiteId={site.id} />
            </div>
          ))}

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 text-sm font-semibold">How to install</h2>
            <ol className="space-y-1 text-sm text-muted-foreground">
              <li>1. Copy the snippet for your website above.</li>
              <li>
                2. Paste it inside the{" "}
                <code className="font-mono text-xs text-foreground">&lt;head&gt;</code> tag
                of every page on your site.
              </li>
              <li>
                3. Within 24 hours, any visitor arriving from an AI platform (ChatGPT,
                Perplexity, Claude, Gemini, etc.) will be recorded automatically.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
