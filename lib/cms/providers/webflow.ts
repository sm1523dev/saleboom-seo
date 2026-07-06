import type { CmsAdapter, CmsCredentials, PushPayload, PushResult, ValidationResult } from "../types";
import { CmsAuthError, CmsNotFoundError } from "../types";
import type { CmsField } from "../types";

type WebflowCreds = CmsCredentials["webflow"];

const API_BASE = "https://api.webflow.com/v2";

async function wfFetch(
  path: string,
  apiToken: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      accept: "application/json",
      ...options.headers,
    },
  });
  if (res.status === 401 || res.status === 403) throw new CmsAuthError("Invalid Webflow API token");
  if (res.status === 404) throw new CmsNotFoundError(path);
  return res;
}

// Webflow field slugs for SEO meta — configurable via collectionId conventions
// Standard Webflow CMS field names used in most templates
const WF_FIELD_MAP: Record<CmsField, string> = {
  meta_title: "seo-title",
  meta_description: "seo-description",
  h1: "name",
};

async function resolveItemId(
  collectionId: string,
  apiToken: string,
  pageUrl: string,
): Promise<string> {
  const slug = pageUrl.replace(/\/$/, "").split("/").pop() ?? "";

  const res = await wfFetch(
    `/collections/${collectionId}/items?limit=100`,
    apiToken,
  );
  if (!res.ok) throw new Error(`Webflow collection fetch failed: ${res.status}`);

  const data = (await res.json()) as {
    items?: Array<{ id: string; fieldData?: { slug?: string; name?: string } }>;
  };

  const item = data.items?.find(
    (i) => i.fieldData?.slug === slug || i.id === slug,
  );

  if (!item) throw new CmsNotFoundError(pageUrl);
  return item.id;
}

export class WebflowAdapter implements CmsAdapter<"webflow"> {
  async validate(creds: WebflowCreds): Promise<ValidationResult> {
    try {
      const res = await wfFetch("/token/authorized_by", creds.apiToken);
      if (!res.ok) return { valid: false, error: `Webflow returned ${res.status}` };
      const data = (await res.json()) as { email?: string; firstName?: string };
      return { valid: true, userLogin: data.email ?? data.firstName ?? "Webflow user" };
    } catch (err) {
      if (err instanceof CmsAuthError) return { valid: false, error: "Invalid API token" };
      return { valid: false, error: "Could not reach Webflow API" };
    }
  }

  async push(payload: PushPayload, creds: WebflowCreds): Promise<PushResult> {
    const itemId = await resolveItemId(creds.collectionId, creds.apiToken, payload.pageUrl);
    const fieldData: Record<string, string> = {};
    const pushedFields: CmsField[] = [];

    for (const [field, value] of Object.entries(payload.fields) as Array<[CmsField, string]>) {
      if (value === undefined) continue;
      const wfField = WF_FIELD_MAP[field];
      if (wfField) {
        fieldData[wfField] = value;
        pushedFields.push(field);
      }
    }

    if (pushedFields.length === 0) return { success: true, pageId: itemId, pushedFields: [] };

    // Patch the collection item
    const patchRes = await wfFetch(
      `/collections/${creds.collectionId}/items/${itemId}`,
      creds.apiToken,
      { method: "PATCH", body: JSON.stringify({ fieldData, isArchived: false, isDraft: false }) },
    );

    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? `Webflow patch failed: ${patchRes.status}`);
    }

    // Publish the item so changes go live immediately
    await wfFetch(
      `/collections/${creds.collectionId}/items/publish`,
      creds.apiToken,
      { method: "POST", body: JSON.stringify({ itemIds: [itemId] }) },
    ).catch(() => {});

    return { success: true, pageId: itemId, pushedFields };
  }
}
