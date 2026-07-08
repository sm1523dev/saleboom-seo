import { requireAdmin } from "@/lib/auth-utils";

export default async function AdminStatsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Stats</h1>
        <p className="text-sm text-muted-foreground">Real-time platform metrics and health.</p>
      </div>
      <div className="card-glow rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Stats dashboard coming in #80.</p>
      </div>
    </div>
  );
}
