export type CmsType = "wordpress" | "shopify" | "webflow" | "github";

export type GitHubFramework = "nextjs-app" | "nextjs-pages" | "hugo" | "jekyll" | "unknown";

export type CmsField = "meta_title" | "meta_description" | "h1";

export type CmsCredentials = {
  wordpress: { siteUrl: string; username: string; applicationPassword: string };
  shopify: { storeUrl: string; accessToken: string };
  webflow: { apiToken: string; collectionId: string };
  github: {
    accessToken: string;
    repoOwner: string;
    repoName: string;
    baseBranch: string;
    framework: GitHubFramework;
    subPath?: string;
  };
};

export type PushPayload = {
  pageUrl: string;
  fields: Partial<Record<CmsField, string>>;
};

export type PushResult = {
  success: boolean;
  pageId: string;
  pushedFields: CmsField[];
  prUrl?: string;
  prNumber?: number;
};

export type ValidationResult = {
  valid: boolean;
  userLogin?: string;
  error?: string;
};

export interface CmsAdapter<T extends CmsType = CmsType> {
  validate(credentials: CmsCredentials[T]): Promise<ValidationResult>;
  push(payload: PushPayload, credentials: CmsCredentials[T]): Promise<PushResult>;
}

// Typed errors surfaced by adapters
export class CmsAuthError extends Error {
  readonly code = "auth_error" as const;
}
export class CmsNotFoundError extends Error {
  readonly code = "not_found" as const;
  constructor(public readonly pageUrl: string) {
    super(`Page not found on CMS: ${pageUrl}`);
  }
}
export class CmsRateLimitError extends Error {
  readonly code = "rate_limit" as const;
}
export class CmsAlreadyRolledBackError extends Error {
  readonly code = "already_rolled_back" as const;
}
