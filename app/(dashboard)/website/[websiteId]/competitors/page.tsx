import type { Metadata } from "next";
import { getServerSession } from "@/lib/auth-utils";
import { CompetitorAnalyzer } from "./_components/competitor-analyzer";

export const metadata: Metadata = {
  title: "Competitor Analysis",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ websiteId: string }> };

export default async function CompetitorsPage({ params }: Props) {
  await getServerSession();
  const { websiteId } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Competitor AI Visibility</h1>
        <p className="text-sm text-muted-foreground">
          Compare your brand&apos;s AI mention rate against up to 3 competitors.
        </p>
      </div>
      <CompetitorAnalyzer websiteId={websiteId} />
    </div>
  );
}
