import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Facebook from "next-auth/providers/facebook";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import type { AuthProvider, AuthSession, SignInOpts, RouteHandlers } from "../types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
    } & DefaultSession["user"];
  }
}

function buildProviders() {
  const list = [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }) as never
    );
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    list.push(
      GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      }) as never
    );
  }
  if (
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  ) {
    list.push(
      MicrosoftEntraID({
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      }) as never
    );
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    list.push(
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      }) as never
    );
  }

  return list;
}

const { handlers, auth, signIn: nextAuthSignIn, signOut: nextAuthSignOut } = NextAuth({
  providers: buildProviders(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        if (account.provider !== "credentials") {
          // Social sign-in: upsert into our users table so app-level queries work
          const [dbUser] = await db
            .insert(users)
            .values({
              email: user.email!,
              name: user.name ?? null,
              avatarUrl: user.image ?? null,
              tenantId:
                profile && "tid" in profile ? (profile.tid as string) : null,
            })
            .onConflictDoUpdate({
              target: users.email,
              set: {
                name: user.name ?? null,
                avatarUrl: user.image ?? null,
                updatedAt: new Date(),
              },
            })
            .returning({ id: users.id });
          token.id = dbUser.id;
          if (profile && "tid" in profile) token.tenantId = profile.tid as string;
        } else {
          token.id = user.id;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (token.tenantId) session.user.tenantId = token.tenantId as string;
      }
      return session;
    },
  },
});

export class AuthJsProvider implements AuthProvider {
  async getSession(): Promise<AuthSession | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    return {
      user: {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
        tenantId: session.user.tenantId,
      },
      expiresAt: session.expires,
    };
  }

  getAvailableProviders(): string[] {
    const providers = ["credentials"];
    if (process.env.GOOGLE_CLIENT_ID) providers.push("google");
    if (process.env.GITHUB_CLIENT_ID) providers.push("github");
    if (process.env.MICROSOFT_CLIENT_ID) providers.push("microsoft-entra-id");
    if (process.env.FACEBOOK_CLIENT_ID) providers.push("facebook");
    return providers;
  }

  async signIn(provider: string, opts?: SignInOpts): Promise<never> {
    return nextAuthSignIn(provider, opts) as Promise<never>;
  }

  async signOut(opts?: { redirectTo?: string }): Promise<never> {
    return nextAuthSignOut(opts) as Promise<never>;
  }

  // NextAuth's auth() wraps any handler and injects request.auth — this is the
  // auth middleware pattern mandated by NextAuth v5. next/server is unavoidable here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMiddleware(): any {
    return auth(async (request: NextRequest & { auth: unknown }) => {
      const { pathname, search } = request.nextUrl;
      if (pathname.startsWith("/dashboard") && !request.auth) {
        const signInUrl = new URL("/sign-in", request.url);
        signInUrl.searchParams.set("callbackUrl", pathname + search);
        const { NextResponse } = await import("next/server");
        return NextResponse.redirect(signInUrl);
      }
    });
  }

  get routeHandlers(): RouteHandlers {
    return handlers as RouteHandlers;
  }
}
