import type { CmsAdapter, CmsCredentials, PushPayload, PushResult, ValidationResult } from "../types";
import { CmsAuthError, CmsNotFoundError, CmsRateLimitError } from "../types";
import type { CmsField } from "../types";

type ShopifyCreds = CmsCredentials["shopify"];

const MAX_RETRIES = 3;

function normalizeStoreUrl(storeUrl: string): string {
  const raw = storeUrl.trim().replace(/\/$/, "");
  // Accept admin.shopify.com/store/<handle> → convert to <handle>.myshopify.com
  const adminMatch = raw.match(/admin\.shopify\.com\/store\/([^/?#]+)/);
  if (adminMatch) return `https://${adminMatch[1]}.myshopify.com`;
  // Accept bare handle (no dots) → append .myshopify.com
  if (!raw.includes(".")) return `https://${raw}.myshopify.com`;
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

async function shopifyGraphQL(
  storeUrl: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
  attempt = 0,
): Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }> {
  const base = normalizeStoreUrl(storeUrl);
  const endpoint = `${base}/admin/api/2024-01/graphql.json`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401 || res.status === 403) throw new CmsAuthError("Invalid Shopify access token");

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new CmsRateLimitError("Shopify rate limit exceeded after retries");
    const delay = Math.pow(2, attempt) * 500;
    await new Promise((r) => setTimeout(r, delay));
    return shopifyGraphQL(storeUrl, accessToken, query, variables, attempt + 1);
  }

  if (!res.ok) throw new Error(`Shopify API returned ${res.status}`);

  return res.json();
}

const PAGE_SEO_MUTATION = `
  mutation pageUpdate($id: ID!, $page: PageInput!) {
    pageUpdate(id: $id, page: $page) {
      page { id title seo { title description } }
      userErrors { field message }
    }
  }
`;

const PRODUCT_SEO_MUTATION = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id title seo { title description } }
      userErrors { field message }
    }
  }
`;

const PAGES_QUERY = `
  query pages($handle: String) {
    pages(first: 1, query: $handle) {
      edges { node { id handle } }
    }
  }
`;

const PRODUCTS_QUERY = `
  query products($handle: String) {
    products(first: 1, query: $handle) {
      edges { node { id handle } }
    }
  }
`;

function extractHandle(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    const segments = parsed.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  } catch {
    return pageUrl.split("/").pop() ?? "";
  }
}

async function resolveShopifyResource(
  creds: ShopifyCreds,
  pageUrl: string,
): Promise<{ id: string; type: "page" | "product" }> {
  const handle = extractHandle(pageUrl);
  const isProduct = pageUrl.includes("/products/");

  if (isProduct) {
    const result = await shopifyGraphQL(creds.storeUrl, creds.accessToken, PRODUCTS_QUERY, { handle: `handle:${handle}` });
    const edges = (result.data?.products as { edges: Array<{ node: { id: string } }> } | undefined)?.edges ?? [];
    if (edges.length === 0) throw new CmsNotFoundError(pageUrl);
    return { id: edges[0].node.id, type: "product" };
  }

  const result = await shopifyGraphQL(creds.storeUrl, creds.accessToken, PAGES_QUERY, { handle: `handle:${handle}` });
  const edges = (result.data?.pages as { edges: Array<{ node: { id: string } }> } | undefined)?.edges ?? [];
  if (edges.length === 0) throw new CmsNotFoundError(pageUrl);
  return { id: edges[0].node.id, type: "page" };
}

export class ShopifyAdapter implements CmsAdapter<"shopify"> {
  async validate(creds: ShopifyCreds): Promise<ValidationResult> {
    try {
      const result = await shopifyGraphQL(
        creds.storeUrl,
        creds.accessToken,
        `query { shop { name } }`,
        {},
      );
      if (result.errors?.length) return { valid: false, error: result.errors[0].message };
      const name = (result.data?.shop as { name?: string } | undefined)?.name;
      return { valid: true, userLogin: name ?? creds.storeUrl };
    } catch (err) {
      if (err instanceof CmsAuthError) return { valid: false, error: "Invalid access token" };
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Shopify validate] error:", msg);
      return { valid: false, error: `Could not reach Shopify store: ${msg}` };
    }
  }

  async push(payload: PushPayload, creds: ShopifyCreds): Promise<PushResult> {
    const { id, type } = await resolveShopifyResource(creds, payload.pageUrl);
    const pushedFields: CmsField[] = [];
    const seo: { title?: string; description?: string } = {};

    if (payload.fields.meta_title !== undefined) {
      seo.title = payload.fields.meta_title;
      pushedFields.push("meta_title");
    }
    if (payload.fields.meta_description !== undefined) {
      seo.description = payload.fields.meta_description;
      pushedFields.push("meta_description");
    }

    if (pushedFields.length === 0 && !payload.fields.h1) {
      return { success: true, pageId: id, pushedFields: [] };
    }

    let result: { data?: Record<string, unknown>; errors?: Array<{ message: string }> };

    if (type === "page") {
      const pageInput: Record<string, unknown> = { id };
      if (Object.keys(seo).length > 0) pageInput.seo = seo;
      if (payload.fields.h1 !== undefined) { pageInput.title = payload.fields.h1; pushedFields.push("h1"); }
      result = await shopifyGraphQL(creds.storeUrl, creds.accessToken, PAGE_SEO_MUTATION, { id, page: pageInput });
      const userErrors = (result.data?.pageUpdate as { userErrors?: Array<{ message: string }> })?.userErrors ?? [];
      if (userErrors.length > 0) throw new Error(userErrors[0].message);
    } else {
      const productInput: Record<string, unknown> = { id };
      if (Object.keys(seo).length > 0) productInput.seo = seo;
      if (payload.fields.h1 !== undefined) { productInput.title = payload.fields.h1; pushedFields.push("h1"); }
      result = await shopifyGraphQL(creds.storeUrl, creds.accessToken, PRODUCT_SEO_MUTATION, { input: productInput });
      const userErrors = (result.data?.productUpdate as { userErrors?: Array<{ message: string }> })?.userErrors ?? [];
      if (userErrors.length > 0) throw new Error(userErrors[0].message);
    }

    return { success: true, pageId: id, pushedFields };
  }
}
