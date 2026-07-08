import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth-utils";
import { getInternalLinkOpportunities } from "@/app/actions/internal-links.actions";
import { InternalLinksView } from "./_components/internal-links-view";

export const metadata: Metadata = {
  title: "Internal Links",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ websiteId: string }> };

export default async function InternalLinksPage({ params }: Props) {
  await getServerSession();
  const { websiteId } = await params;
  const result = await getInternalLinkOpportunities(websiteId);

  if ("error" in result) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Internal Links</h1>
        <div className="card-glow rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Internal Link Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          {result.length} {result.length === 1 ? "opportunity" : "opportunities"} found across your site
        </p>
      </div>
      <InternalLinksView opportunities={result} />
    </div>
  );
}
