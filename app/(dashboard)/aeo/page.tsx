import { redirect } from "next/navigation";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";

// AEO data is now part of the per-website detail page.
// Redirect to the most relevant destination.
export default async function AeoPage() {
  const session = await getServerSession();
  const [site] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .orderBy(desc(websites.createdAt))
    .limit(1);

  if (site) redirect(`/website/${site.id}`);
  redirect("/dashboard");
}
