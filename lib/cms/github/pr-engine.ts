type GhFileMeta = { sha: string; content: string };
type PrResult = { prUrl: string; prNumber: number };

function slugFromUrl(pageUrl: string): string {
  try {
    const path = new URL(pageUrl).pathname;
    return path.replace(/^\//, "").replace(/\//g, "-") || "home";
  } catch {
    return pageUrl.replace(/^\//, "").replace(/\//g, "-") || "home";
  }
}

function fieldLabel(field: string): string {
  if (field === "meta_title") return "page title";
  if (field === "meta_description") return "meta description";
  if (field === "h1") return "heading (H1)";
  return field;
}

export class PrCreationEngine {
  private base: string;

  constructor(
    readonly token: string,
    readonly owner: string,
    readonly repo: string,
    private baseBranch: string,
  ) {
    this.base = `https://api.github.com/repos/${owner}/${repo}`;
  }

  private async gh<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "SaleBoomSEO",
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status}: ${path} — ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async getFile(path: string): Promise<GhFileMeta> {
    const data = await this.gh<{ sha: string; content: string }>(`/contents/${path}`);
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { sha: data.sha, content };
  }

  async fileExists(path: string): Promise<boolean> {
    const res = await fetch(`${this.base}/contents/${path}`, {
      headers: { Authorization: `Bearer ${this.token}`, "User-Agent": "SaleBoomSEO" },
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  }

  private async getBaseSha(): Promise<string> {
    const ref = await this.gh<{ object: { sha: string } }>(`/git/ref/heads/${this.baseBranch}`);
    return ref.object.sha;
  }

  async createBranch(branchName: string): Promise<void> {
    const sha = await this.getBaseSha();
    await this.gh(`/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });
  }

  async commitFile(
    filePath: string,
    content: string,
    message: string,
    branchName: string,
    fileSha: string,
  ): Promise<void> {
    await this.gh(`/contents/${filePath}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString("base64"),
        sha: fileSha,
        branch: branchName,
      }),
    });
  }

  async createPr(
    branchName: string,
    title: string,
    body: string,
  ): Promise<PrResult> {
    const pr = await this.gh<{ html_url: string; number: number }>(`/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: this.baseBranch,
      }),
    });
    return { prUrl: pr.html_url, prNumber: pr.number };
  }

  async closePr(prNumber: number): Promise<void> {
    await this.gh(`/pulls/${prNumber}`, {
      method: "PATCH",
      body: JSON.stringify({ state: "closed" }),
    });
  }

  async createRevertPr(
    originalBranchName: string,
    originalFilePath: string,
    originalContent: string,
    originalFileSha: string,
    field: string,
    pageUrl: string,
    scanResultsUrl: string,
  ): Promise<PrResult> {
    const slug = slugFromUrl(pageUrl);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const revertBranch = await this.buildBranchName(`revert-seo-${field.replace("_", "-")}-${slug}`, today);

    await this.createBranch(revertBranch);
    await this.commitFile(
      originalFilePath,
      originalContent,
      `revert: restore ${fieldLabel(field)} on /${slug}`,
      revertBranch,
      originalFileSha,
    );

    return this.createPr(
      revertBranch,
      `Revert: restore ${fieldLabel(field)} on /${slug}`,
      buildPrBody({ field, pageUrl, beforeValue: "(original)", afterValue: "(reverted)", scanResultsUrl }),
    );
  }

  async buildBranchName(base: string, today: string): Promise<string> {
    const candidate = `saleboom/${base}-${today}`;
    const exists = await this.branchExists(candidate);
    if (!exists) return candidate;
    for (let i = 2; i <= 10; i++) {
      const next = `${candidate}-${i}`;
      if (!(await this.branchExists(next))) return next;
    }
    return `${candidate}-${Date.now()}`;
  }

  private async branchExists(name: string): Promise<boolean> {
    const res = await fetch(`${this.base}/git/ref/heads/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${this.token}`, "User-Agent": "SaleBoomSEO" },
    });
    return res.ok;
  }
}

export function buildBranchName(field: string, pageUrl: string, today: string): string {
  const slug = slugFromUrl(pageUrl);
  const f = field.replace("_", "-");
  return `saleboom/seo-${f}-${slug}-${today}`;
}

type PrBodyArgs = {
  field: string;
  pageUrl: string;
  beforeValue: string | null | undefined;
  afterValue: string;
  scanResultsUrl: string;
  issueTitle?: string;
  issueSeverity?: string;
};

export function buildPrBody({
  field,
  pageUrl,
  beforeValue,
  afterValue,
  scanResultsUrl,
  issueTitle,
  issueSeverity,
}: PrBodyArgs): string {
  const label = fieldLabel(field);
  let body = `## SEO Fix: ${label}\n\n`;
  body += `**Page:** ${pageUrl}\n\n`;
  body += `| | Value |\n|---|---|\n`;
  body += `| **Before** | ${beforeValue || "_not set_"} |\n`;
  body += `| **After** | ${afterValue} |\n\n`;
  if (issueTitle) body += `**Issue:** ${issueTitle}${issueSeverity ? ` (${issueSeverity})` : ""}\n\n`;
  body += `---\n\n_Generated by [SaleBoom SEO](${scanResultsUrl}) — merge this PR to apply the fix._\n`;
  return body;
}
