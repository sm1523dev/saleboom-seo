import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-utils";
import { loadCredentials } from "@/lib/cms/credentials";

type GithubRepo = {
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
};

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await getServerSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const websiteId = searchParams.get("websiteId");
  if (!websiteId) return NextResponse.json({ error: "Missing websiteId" }, { status: 400 });

  const creds = await loadCredentials(websiteId, "github");
  if (!creds?.accessToken) return NextResponse.json({ error: "GitHub not authorized" }, { status: 401 });

  const res = await fetch(
    "https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100",
    { headers: { Authorization: `Bearer ${creds.accessToken}`, "User-Agent": "SaleBoomSEO" } },
  );

  if (!res.ok) {
    return NextResponse.json({ error: "GitHub API error" }, { status: 502 });
  }

  const raw = (await res.json()) as GithubRepo[];
  const repos = raw.map((r) => ({
    fullName: r.full_name,
    owner: r.owner.login,
    name: r.name,
    defaultBranch: r.default_branch,
    private: r.private,
  }));

  return NextResponse.json({ repos });
}
