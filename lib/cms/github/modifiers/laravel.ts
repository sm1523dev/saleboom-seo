export type ModifyResult =
  | { modified: true; content: string; filePath: string }
  | { modified: false; error: string };

// Laravel Blade directive patterns:
// @section('title', 'About Us')
// @section('title')About Us@endsection
// @section("title", "About Us")

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function modifyLaravelBlade(
  source: string,
  field: "meta_title" | "meta_description",
  newValue: string,
): ModifyResult {
  const sectionNames = field === "meta_title"
    ? ["title", "page_title", "seo_title", "head_title"]
    : ["description", "meta_description", "seo_description", "page_description"];

  const safeValue = escapeHtml(newValue);

  for (const name of sectionNames) {
    // @section('name', 'value') — inline form
    const inlineRe = new RegExp(
      `(@section\\s*\\(\\s*['"]${name}['"]\\s*,\\s*['"])(.*?)(['"]\\s*\\))`,
      "i",
    );
    if (inlineRe.test(source)) {
      const updated = source.replace(inlineRe, `$1${safeValue}$3`);
      return { modified: true, content: updated, filePath: "" };
    }

    // @section('name') ... @endsection — block form
    const blockRe = new RegExp(
      `(@section\\s*\\(\\s*['"]${name}['"]\\s*\\))(.*?)(@endsection)`,
      "is",
    );
    if (blockRe.test(source)) {
      const updated = source.replace(blockRe, `$1${safeValue}$3`);
      return { modified: true, content: updated, filePath: "" };
    }
  }

  // Fallback: <title>...</title> or meta description tag
  const titleRe = /<title>(.*?)<\/title>/is;
  if (field === "meta_title" && titleRe.test(source)) {
    const updated = source.replace(titleRe, `<title>${safeValue}</title>`);
    return { modified: true, content: updated, filePath: "" };
  }

  const metaRe = /(<meta\s+name=["']description["']\s+content=["'])(.*?)(["'])/is;
  const metaRe2 = /(<meta\s+content=["'])(.*?)(["']\s+name=["']description["'])/is;
  if (field === "meta_description") {
    if (metaRe.test(source)) {
      return { modified: true, content: source.replace(metaRe, `$1${safeValue}$3`), filePath: "" };
    }
    if (metaRe2.test(source)) {
      return { modified: true, content: source.replace(metaRe2, `$1${safeValue}$3`), filePath: "" };
    }
  }

  const fieldHuman = field === "meta_title" ? "title section" : "meta description section";
  return {
    modified: false,
    error: `Could not find ${fieldHuman} in Blade template — expected @section('title', '...') or @section('title') ... @endsection`,
  };
}
