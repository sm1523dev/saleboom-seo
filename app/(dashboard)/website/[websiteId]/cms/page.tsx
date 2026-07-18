import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { getCmsConnection } from "@/app/actions/cms.actions";
import { CmsConnectForm } from "./_components/cms-connect-form";

export const metadata: Metadata = {
  title: "CMS Connection",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CmsConnectionPage({ params, searchParams }: Props) {
  const { websiteId } = await params;
  const sp = await searchParams;
  const githubStep = typeof sp.github_step === "string" ? sp.github_step : null;
  await getServerSession();

  const [website] = await db
    .select({ id: websites.id, name: websites.name, url: websites.url })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);

  if (!website) notFound();

  const connectionState = await getCmsConnection(websiteId);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link
          href={`/website/${websiteId}`}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {website.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">CMS Connection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your CMS to push AI-suggested SEO fixes directly to your site.
        </p>
      </header>

      <section className="max-w-lg" aria-label="CMS connection form">
        <CmsConnectForm websiteId={websiteId} initialState={connectionState} githubStep={githubStep} />
      </section>

      <section className="max-w-lg rounded-xl border border-border bg-muted/20 p-5" aria-label="How it works">
        <h2 className="mb-3 text-sm font-semibold">How application passwords work</h2>
        <ol className="space-y-2 text-xs text-muted-foreground">
          <li className="flex gap-2"><span className="text-primary">1.</span> Log in to your WordPress admin panel</li>
          <li className="flex gap-2"><span className="text-primary">2.</span> Go to Users → Your Profile → scroll to Application Passwords</li>
          <li className="flex gap-2"><span className="text-primary">3.</span> Enter a name (e.g. &ldquo;SaleBoom SEO&rdquo;) and click Add New</li>
          <li className="flex gap-2"><span className="text-primary">4.</span> Copy the generated password — it is shown only once</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Credentials are encrypted and never stored in plain text or returned in API responses.
        </p>
      </section>
    </div>
  );
}
