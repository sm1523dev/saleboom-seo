import { requireAdmin } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { UserTable } from "./_components/user-table";

export const metadata = { title: "User Management" };

export default async function UsersPage() {
  const session = await requireAdmin();

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">
          {allUsers.length} total users · {allUsers.filter(u => u.role === "admin").length} admins
        </p>
      </div>
      <UserTable users={allUsers} currentUserId={session.user.id} />
    </div>
  );
}
