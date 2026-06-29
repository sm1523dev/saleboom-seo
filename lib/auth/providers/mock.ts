import { NextResponse } from "next/server";
import type { AuthProvider, AuthSession, RouteHandlers } from "../types";

const MOCK_SESSION: AuthSession = {
  user: {
    id: "mock-user-id",
    email: "dev@saleboom.com",
    name: "Dev User",
  },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

export class MockAuthProvider implements AuthProvider {
  async getSession(): Promise<AuthSession | null> {
    return MOCK_SESSION;
  }

  async requireSession(): Promise<AuthSession> {
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
    return async (_request: Request) => {
      return NextResponse.next();
    };
  }

  get routeHandlers(): RouteHandlers {
    const handler = async () => NextResponse.json({ ok: true });
    return { GET: handler, POST: handler };
  }
}
