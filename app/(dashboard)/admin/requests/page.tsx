import { requireAdmin } from "@/lib/auth-utils";
import { getProviderRequests } from "@/app/actions/provider-requests.actions";
import { RequestList } from "./_components/request-list";

export const metadata = { title: "Provider Requests" };

export default async function RequestsPage() {
  await requireAdmin();
  const requests = await getProviderRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provider Requests</h1>
        <p className="text-sm text-muted-foreground">
          Requests for new provider integrations. Forward to a developer or update status.
        </p>
      </div>
      <RequestList requests={requests} />
    </div>
  );
}
