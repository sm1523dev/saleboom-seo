export type ModifyResult =
  | { modified: true; content: string; filePath: string }
  | { modified: false; error: string };

// Django template block patterns:
// {% block title %}Page Title{% endblock %}
// {% block title %}Page Title{% endblock title %}
// Also handles: {% block meta_description %}...{% endblock %}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function modifyDjangoTemplate(
  source: string,
  field: "meta_title" | "meta_description",
  newValue: string,
): ModifyResult {
  // Map field to the block name to look for
  const blockNames = field === "meta_title"
    ? ["title", "page_title", "seo_title", "head_title"]
    : ["description", "meta_description", "seo_description", "page_description"];

  const safeValue = escapeHtml(newValue);

  for (const blockName of blockNames) {
    // Match {% block <name> %}...{% endblock %} or {% endblock <name> %}
    // Using non-greedy, case-insensitive match
    const re = new RegExp(
      `({%[-\\s]*block\\s+${blockName}\\s*[-\\s]*%})(.*?)({%[-\\s]*endblock(?:\\s+${blockName})?\\s*[-\\s]*%})`,
      "is",
    );
    const match = source.match(re);
    if (match) {
      const updated = source.replace(re, `$1${safeValue}$3`);
      return { modified: true, content: updated, filePath: "" };
    }
  }

  // Also handle <title>...</title> for base templates that don't use blocks
  const titleRe = /<title>(.*?)<\/title>/is;
  if (field === "meta_title" && titleRe.test(source)) {
    const updated = source.replace(titleRe, `<title>${safeValue}</title>`);
    return { modified: true, content: updated, filePath: "" };
  }

  // meta description tag
  const metaRe = /(<meta\s+name=["']description["']\s+content=["'])(.*?)(["'])/is;
  const metaRe2 = /(<meta\s+content=["'])(.*?)(["']\s+name=["']description["'])/is;
  if (field === "meta_description") {
    if (metaRe.test(source)) {
      const updated = source.replace(metaRe, `$1${safeValue}$3`);
      return { modified: true, content: updated, filePath: "" };
    }
    if (metaRe2.test(source)) {
      const updated = source.replace(metaRe2, `$1${safeValue}$3`);
      return { modified: true, content: updated, filePath: "" };
    }
  }

  const fieldHuman = field === "meta_title" ? "title block" : "meta description block";
  return {
    modified: false,
    error: `Could not find ${fieldHuman} in template — expected {% block title %}...{% endblock %} or <title>...</title>`,
  };
}
