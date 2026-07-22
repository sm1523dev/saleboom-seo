export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  image?: string;
  tenantId?: string;
  role: "admin" | "user";
};

export type AuthSession = {
  user: AuthUser;
  expiresAt: string;
};

export type SignInOpts = {
  callbackUrl?: string;
  redirectTo?: string;
};

export type RouteHandlers = {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
};

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  getAvailableProviders(): string[];
  signIn(provider: string, opts?: SignInOpts): Promise<never>;
  signOut(opts?: { redirectTo?: string; redirect?: false }): Promise<void>;
  // Provider-specific middleware (NextAuth, Clerk, etc.) — intentionally untyped
  // because each provider returns a different internal handler signature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMiddleware(): any;
  readonly routeHandlers: RouteHandlers;
}
