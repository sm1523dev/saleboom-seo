import type { AuthProvider, AuthSession, RouteHandlers } from "../types";

const MOCK_SESSION: AuthSession = {
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "dev@saleboom.com",
    name: "Dev User",
    role: "admin" as const,
  },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

export class MockAuthProvider implements AuthProvider {
  async getSession(): Promise<AuthSession | null> {
    return MOCK_SESSION;
  }

  getAvailableProviders(): string[] {
    return ["mock"];
  }

  async signIn(_provider: string, opts?: { redirectTo?: string }): Promise<never> {
    const { redirect } = await import("next/navigation");
    return redirect(opts?.redirectTo ?? "/dashboard") as never;
  }

  async signOut(opts?: { redirectTo?: string }): Promise<never> {
    const { redirect } = await import("next/navigation");
    return redirect(opts?.redirectTo ?? "/sign-in") as never;
  }

  getMiddleware() {
    return async () => undefined;
  }

  get routeHandlers(): RouteHandlers {
    const handler = async () => Response.json({ ok: true });
    return { GET: handler, POST: handler };
  }
}
