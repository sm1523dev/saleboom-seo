import type { ParsedPage, SiteContext, SeoIssue, PageRule } from "../types";

type JsonLdNode = Record<string, unknown>;

function isNode(val: unknown): val is JsonLdNode {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function getType(node: JsonLdNode): string {
  const t = node["@type"];
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.join(",");
  return "";
}

function isHomepage(pageUrl: string, baseUrl: string): boolean {
  try {
    const page = new URL(pageUrl);
    const base = new URL(baseUrl);
    return page.origin === base.origin && (page.pathname === "/" || page.pathname === "");
  } catch {
    return false;
  }
}

const structuredDataPageRules: PageRule[] = [
  // 31. No JSON-LD structured data at all
  (p) =>
    p.jsonLd.length === 0
      ? [
          {
            type: "jsonld-missing",
            severity: "medium",
            title: "No structured data (JSON-LD) found",
            description: `${p.url} has no <script type="application/ld+json"> blocks. Structured data enables rich results in Google SERPs and improves AEO visibility.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 32. Malformed JSON-LD (parse errors)
  (p) =>
    p.jsonLdParseErrors > 0
      ? [
          {
            type: "jsonld-malformed",
            severity: "high",
            title: "Malformed JSON-LD structured data",
            description: `${p.url} has ${p.jsonLdParseErrors} JSON-LD block${p.jsonLdParseErrors > 1 ? "s" : ""} with parse errors. Invalid JSON is silently ignored by search engines, losing all structured data benefits.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 33. JSON-LD block missing @type
  (p) => {
    const missingType = p.jsonLd.filter(
      (j) => isNode(j) && !getType(j as JsonLdNode)
    );
    if (missingType.length === 0) return [];
    return [
      {
        type: "jsonld-missing-type",
        severity: "high",
        title: "JSON-LD block missing @type",
        description: `${p.url} has ${missingType.length} JSON-LD block${missingType.length > 1 ? "s" : ""} without an @type property. Typeless JSON-LD is not recognized by search engines.`,
        fixType: "major",
        pageUrl: p.url,
      },
    ];
  },

  // 34. Homepage missing WebSite schema
  (p, ctx) => {
    if (!isHomepage(p.url, ctx.baseUrl)) return [];
    const hasWebSite = p.jsonLd.some(
      (j) => isNode(j) && getType(j as JsonLdNode).includes("WebSite")
    );
    if (!hasWebSite) {
      return [
        {
          type: "jsonld-website-missing",
          severity: "medium",
          title: "Homepage missing WebSite schema",
          description: `${p.url} is the homepage but has no WebSite JSON-LD schema. WebSite schema enables sitelinks search box and brand recognition in SERPs.`,
          fixType: "major",
          pageUrl: p.url,
        },
      ];
    }
    return [];
  },

  // 35. Article schema missing required author field
  (p) => {
    const issues: SeoIssue[] = [];
    for (const j of p.jsonLd) {
      if (!isNode(j)) continue;
      const node = j as JsonLdNode;
      const type = getType(node);
      if (!type.includes("Article") && !type.includes("BlogPosting") && !type.includes("NewsArticle")) continue;
      if (!node["author"]) {
        issues.push({
          type: "jsonld-article-no-author",
          severity: "medium",
          title: "Article schema missing author",
          description: `${p.url} has ${type} JSON-LD without an author field. Google requires author for Article rich results.`,
          fixType: "major",
          pageUrl: p.url,
        });
      }
    }
    return issues;
  },

  // 36. Article schema missing datePublished
  (p) => {
    const issues: SeoIssue[] = [];
    for (const j of p.jsonLd) {
      if (!isNode(j)) continue;
      const node = j as JsonLdNode;
      const type = getType(node);
      if (!type.includes("Article") && !type.includes("BlogPosting") && !type.includes("NewsArticle")) continue;
      if (!node["datePublished"]) {
        issues.push({
          type: "jsonld-article-no-date",
          severity: "medium",
          title: "Article schema missing datePublished",
          description: `${p.url} has ${type} JSON-LD without a datePublished field. Publication dates improve freshness signals in search results.`,
          fixType: "major",
          pageUrl: p.url,
        });
      }
    }
    return issues;
  },

  // 37. FAQPage schema present but questions lack accepted answers
  (p) => {
    for (const j of p.jsonLd) {
      if (!isNode(j)) continue;
      const node = j as JsonLdNode;
      if (!getType(node).includes("FAQPage")) continue;

      const entities = node["mainEntity"];
      if (!Array.isArray(entities)) continue;

      const missing = entities.filter((e: unknown) => {
        if (!isNode(e)) return false;
        const answer = (e as JsonLdNode)["acceptedAnswer"];
        return !answer;
      });

      if (missing.length > 0) {
        return [
          {
            type: "jsonld-faq-missing-answers",
            severity: "medium",
            title: "FAQPage schema missing acceptedAnswer on some questions",
            description: `${p.url} has FAQPage JSON-LD but ${missing.length} question${missing.length > 1 ? "s" : ""} lack an acceptedAnswer. Google requires acceptedAnswer to display FAQ rich results.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ];
      }
    }
    return [];
  },
];

export function runStructuredDataRules(
  pages: ParsedPage[],
  ctx: SiteContext
): SeoIssue[] {
  return structuredDataPageRules.flatMap((rule) =>
    pages.flatMap((page) => rule(page, ctx))
  );
}
