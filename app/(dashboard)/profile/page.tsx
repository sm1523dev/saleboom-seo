import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { ProfileForm } from "./_components/profile-form";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getServerSession();

  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      tenantId: users.tenantId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const isSocialAccount = !user?.passwordHash;
  const socialProvider = user?.tenantId ? "microsoft" : isSocialAccount ? "social" : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account details
        </p>
      </header>

      <ProfileForm
        name={user?.name ?? null}
        email={user?.email ?? session.user.email}
        isSocialAccount={isSocialAccount}
        socialProvider={socialProvider}
        createdAt={user?.createdAt?.toISOString() ?? null}
      />
    </div>
  );
}
