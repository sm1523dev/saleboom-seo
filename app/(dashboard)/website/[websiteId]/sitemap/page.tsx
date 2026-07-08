import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth-utils";
import { analyzeSitemap } from "@/app/actions/sitemap.actions";
import { SitemapManager } from "./_components/sitemap-manager";

export const metadata: Metadata = {
  title: "Sitemap",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ websiteId: string }> };

export default async function SitemapPage({ params }: Props) {
  await getServerSession();
  const { websiteId } = await params;
  const result = await analyzeSitemap(websiteId);

  if ("error" in result) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Sitemap</h1>
        <div className="card-glow rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sitemap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.crawledUrls.length} crawled pages &middot;{" "}
          {result.sitemapUrls.length} in sitemap.xml
        </p>
      </div>
      <SitemapManager analysis={result} websiteId={websiteId} />
    </div>
  );
}
