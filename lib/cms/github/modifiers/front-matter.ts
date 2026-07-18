import * as yaml from "js-yaml";
import TOML from "@iarna/toml";

export type ModifyResult =
  | { modified: true; content: string; filePath: string }
  | { modified: false; error: string };

type FmFormat = "yaml" | "toml" | "json";

type ParsedFm = {
  format: FmFormat;
  data: Record<string, unknown>;
  body: string;
  openDelim: string;
  closeDelim: string;
};

function parseFrontMatter(source: string): ParsedFm | null {
  // YAML front matter: --- ... ---
  const yamlMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (yamlMatch) {
    try {
      const data = (yaml.load(yamlMatch[1]) ?? {}) as Record<string, unknown>;
      return { format: "yaml", data, body: yamlMatch[2], openDelim: "---", closeDelim: "---" };
    } catch { return null; }
  }

  // TOML front matter: +++ ... +++
  const tomlMatch = source.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n?([\s\S]*)$/);
  if (tomlMatch) {
    try {
      const data = TOML.parse(tomlMatch[1]) as Record<string, unknown>;
      return { format: "toml", data, body: tomlMatch[2], openDelim: "+++", closeDelim: "+++" };
    } catch { return null; }
  }

  // JSON front matter: ---json { } ---
  const jsonMatch = source.match(/^---json\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      return { format: "json", data, body: jsonMatch[2], openDelim: "---json", closeDelim: "---" };
    } catch { return null; }
  }

  return null;
}

function serializeFm(format: FmFormat, data: Record<string, unknown>): string {
  if (format === "yaml") return yaml.dump(data, { lineWidth: -1 }).trim();
  if (format === "toml") return TOML.stringify(data as TOML.JsonMap).trim();
  return JSON.stringify(data, null, 2);
}

function setNestedKey(obj: Record<string, unknown>, keyPath: string, value: string): void {
  const parts = keyPath.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function getField(data: Record<string, unknown>, field: "meta_title" | "meta_description"): {
  keyPath: string;
  value: unknown;
} {
  // Standard keys
  if (field === "meta_title") {
    if ("title" in data) return { keyPath: "title", value: data.title };
    // Nested: seo.title
    const seo = data.seo as Record<string, unknown> | undefined;
    if (seo && "title" in seo) return { keyPath: "seo.title", value: seo.title };
  } else {
    if ("description" in data) return { keyPath: "description", value: data.description };
    const seo = data.seo as Record<string, unknown> | undefined;
    if (seo && "description" in seo) return { keyPath: "seo.description", value: seo.description };
  }
  // Key not found — add it at top level
  return { keyPath: field === "meta_title" ? "title" : "description", value: undefined };
}

export function modifyFrontMatter(
  source: string,
  field: "meta_title" | "meta_description",
  newValue: string,
): ModifyResult {
  const parsed = parseFrontMatter(source);
  if (!parsed) return { modified: false, error: "Could not parse front matter — no YAML, TOML, or JSON block found" };

  const { format, data, body, openDelim, closeDelim } = parsed;

  const { keyPath, value } = getField(data, field);

  // Detect Hugo/Jekyll templating — do not modify
  if (typeof value === "string" && /\{\{|\{%/.test(value)) {
    return { modified: false, error: `Field "${keyPath}" contains template syntax — manual edit required` };
  }

  setNestedKey(data, keyPath, newValue);

  const serialized = serializeFm(format, data);
  const output = `${openDelim}\n${serialized}\n${closeDelim}\n${body}`;

  return { modified: true, content: output, filePath: "" };
}

// Hugo: /about → content/about/index.md or content/about.md, / → content/_index.md
export function hugoFilePaths(pageUrl: string, subPath?: string): string[] {
  const prefix = subPath ? `${subPath.replace(/\/$/, "")}/` : "";
  const pathname = (() => {
    try { return new URL(pageUrl).pathname; } catch { return pageUrl; }
  })().replace(/\/$/, "");

  if (!pathname || pathname === "/") {
    return [`${prefix}content/_index.md`];
  }

  const slug = pathname.replace(/^\//, "");
  return [
    `${prefix}content/${slug}/index.md`,
    `${prefix}content/${slug}.md`,
    `${prefix}content/${slug}/index.markdown`,
  ];
}

// Jekyll: /about → about.md, _pages/about.md, about/index.md
export function jekyllFilePaths(pageUrl: string, subPath?: string): string[] {
  const prefix = subPath ? `${subPath.replace(/\/$/, "")}/` : "";
  const pathname = (() => {
    try { return new URL(pageUrl).pathname; } catch { return pageUrl; }
  })().replace(/\/$/, "").replace(/^\//, "");

  if (!pathname) {
    return [`${prefix}index.md`, `${prefix}index.html`, `${prefix}index.markdown`];
  }

  return [
    `${prefix}${pathname}.md`,
    `${prefix}_pages/${pathname}.md`,
    `${prefix}${pathname}/index.md`,
    `${prefix}${pathname}.markdown`,
  ];
}
