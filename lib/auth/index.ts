import type { AuthProvider } from "./types";

function createProvider(): AuthProvider {
  const name = process.env.AUTH_PROVIDER ?? "authjs";

  switch (name) {
    case "authjs":
      return new (require("./providers/authjs").AuthJsProvider)();
    case "mock":
      return new (require("./providers/mock").MockAuthProvider)();
    default:
      throw new Error(
        `Unknown AUTH_PROVIDER: "${name}". Valid: authjs, mock`
      );
  }
}

export const authProvider: AuthProvider = createProvider();

export type { AuthProvider, AuthSession, AuthUser } from "./types";
