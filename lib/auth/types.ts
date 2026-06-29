export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  image?: string;
  tenantId?: string;
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
  requireSession(): Promise<AuthSession>;
  getAvailableProviders(): string[];
  signIn(provider: string, opts?: SignInOpts): Promise<never>;
  signOut(opts?: { redirectTo?: string }): Promise<never>;
  // Returns provider-specific middleware (Auth.js, Clerk, etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMiddleware(): any;
  readonly routeHandlers: RouteHandlers;
}
