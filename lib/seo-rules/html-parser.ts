import { parse } from "node-html-parser";
import type { ParsedImage } from "./types";

export interface HtmlParseResult {
  langAttr: string | undefined;
  canonical: string | undefined;
  robotsMeta: string | undefined;
  viewport: string | undefined;
  charset: string | undefined;
  twitterCard: string | undefined;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  jsonLd: unknown[];
  jsonLdParseErrors: number;
  images: ParsedImage[];
  internalLinks: string[];
  externalLinks: string[];
  blankTargetLinksNoRel: string[];
  mixedContentSrcs: string[];
}

export function parseHtmlForSeo(
  html: string | undefined,
  pageUrl: string
): HtmlParseResult {
  if (!html) return emptyResult();

  const root = parse(html, {
    blockTextElements: { script: true, noscript: false, style: false },
  });

  const langAttr = root.querySelector("html")?.getAttribute("lang") ?? undefined;

  const canonical =
    root
      .querySelector("link[rel='canonical']")
      ?.getAttribute("href") ?? undefined;

  const robotsMeta =
    root
      .querySelector("meta[name='robots'], meta[name='ROBOTS']")
      ?.getAttribute("content") ?? undefined;

  const viewport =
    root
      .querySelector("meta[name='viewport']")
      ?.getAttribute("content") ?? undefined;

  const charset =
    root.querySelector("meta[charset]")?.getAttribute("charset") ??
    root
      .querySelector("meta[http-equiv='Content-Type']")
      ?.getAttribute("content") ??
    undefined;

  const twitterCard =
    root
      .querySelector("meta[name='twitter:card']")
      ?.getAttribute("content") ?? undefined;

  const h1s = root
    .querySelectorAll("h1")
    .map((el) => el.text.trim())
    .filter(Boolean);
  const h2s = root
    .querySelectorAll("h2")
    .map((el) => el.text.trim())
    .filter(Boolean);
  const h3s = root
    .querySelectorAll("h3")
    .map((el) => el.text.trim())
    .filter(Boolean);

  // JSON-LD — script[type="application/ld+json"]
  let jsonLdParseErrors = 0;
  const jsonLd = root
    .querySelectorAll("script[type='application/ld+json']")
    .map((el) => {
      try {
        return JSON.parse(el.text) as unknown;
      } catch {
        jsonLdParseErrors++;
        return null;
      }
    })
    .filter((j): j is unknown => j !== null);

  // Images
  const images: ParsedImage[] = root.querySelectorAll("img").map((img) => ({
    src: img.getAttribute("src") ?? "",
    alt: img.hasAttribute("alt") ? (img.getAttribute("alt") ?? "") : null,
    hasWidthHeight:
      img.hasAttribute("width") && img.hasAttribute("height"),
  }));

  // Links
  const isHttps = pageUrl.startsWith("https://");
  let baseOrigin: string;
  try {
    baseOrigin = new URL(pageUrl).origin;
  } catch {
    baseOrigin = "";
  }

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  const blankTargetLinksNoRel: string[] = [];

  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    let abs: string;
    try {
      abs = new URL(href, pageUrl).href;
    } catch {
      continue;
    }

    if (baseOrigin && abs.startsWith(baseOrigin)) {
      internalLinks.push(abs);
    } else {
      externalLinks.push(abs);
    }

    // target="_blank" without rel containing "noopener"
    const target = a.getAttribute("target");
    if (target === "_blank") {
      const rel = a.getAttribute("rel") ?? "";
      if (!rel.includes("noopener")) {
        blankTargetLinksNoRel.push(abs);
      }
    }
  }

  // Mixed content — http:// resources on https page
  const mixedContentSrcs: string[] = [];
  if (isHttps) {
    for (const el of root.querySelectorAll("img[src], script[src], link[href], source[src], iframe[src]")) {
      const src = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      if (src.startsWith("http://")) {
        mixedContentSrcs.push(src);
      }
    }
  }

  return {
    langAttr,
    canonical,
    robotsMeta,
    viewport,
    charset,
    twitterCard,
    h1s,
    h2s,
    h3s,
    jsonLd,
    jsonLdParseErrors,
    images,
    internalLinks,
    externalLinks,
    blankTargetLinksNoRel,
    mixedContentSrcs,
  };
}

function emptyResult(): HtmlParseResult {
  return {
    langAttr: undefined,
    canonical: undefined,
    robotsMeta: undefined,
    viewport: undefined,
    charset: undefined,
    twitterCard: undefined,
    h1s: [],
    h2s: [],
    h3s: [],
    jsonLd: [],
    jsonLdParseErrors: 0,
    images: [],
    internalLinks: [],
    externalLinks: [],
    blankTargetLinksNoRel: [],
    mixedContentSrcs: [],
  };
}
