import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    jwt({ token, user, profile }) {
      if (user?.id) token.id = user.id;
      if (profile && "tid" in profile) token.tenantId = profile.tid as string;
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
