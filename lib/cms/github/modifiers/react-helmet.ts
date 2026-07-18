import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import MagicString from "magic-string";

export type ModifyResult =
  | { modified: true; content: string; filePath: string }
  | { modified: false; error: string };

function parse(source: string) {
  return parser.parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    errorRecovery: false,
  });
}

// React Helmet: find <Helmet> JSX component, update <title> and <meta name="description">
export function modifyReactHelmet(
  source: string,
  field: "meta_title" | "meta_description",
  newValue: string,
): ModifyResult {
  let ast: ReturnType<typeof parse>;
  try { ast = parse(source); } catch (e) {
    return { modified: false, error: `Parse failed: ${String(e)}` };
  }

  const ms = new MagicString(source);
  let found = false;

  traverse(ast, {
    JSXElement(path) {
      const opening = path.node.openingElement;
      if (opening.name.type !== "JSXIdentifier") return;
      if (opening.name.name !== "Helmet") return;

      for (const child of path.node.children) {
        if (child.type !== "JSXElement") continue;
        const co = child.openingElement;
        if (co.name.type !== "JSXIdentifier") continue;

        if (field === "meta_title" && co.name.name === "title") {
          for (const tc of child.children) {
            if (tc.type === "JSXText") {
              ms.overwrite(tc.start!, tc.end!, newValue);
              found = true;
            } else if (tc.type === "JSXExpressionContainer" && tc.expression.type === "StringLiteral") {
              ms.overwrite(tc.expression.start!, tc.expression.end!, JSON.stringify(newValue));
              found = true;
            }
          }
        }

        if (field === "meta_description" && co.name.name === "meta") {
          const nameAttr = co.attributes.find(
            (a) => a.type === "JSXAttribute" &&
              a.name.type === "JSXIdentifier" && a.name.name === "name" &&
              a.value?.type === "StringLiteral" && a.value.value === "description",
          );
          if (!nameAttr) continue;
          const contentAttr = co.attributes.find(
            (a) => a.type === "JSXAttribute" &&
              a.name.type === "JSXIdentifier" && a.name.name === "content",
          );
          if (!contentAttr || contentAttr.type !== "JSXAttribute") continue;
          if (contentAttr.value?.type === "StringLiteral") {
            ms.overwrite(contentAttr.value.start!, contentAttr.value.end!, JSON.stringify(newValue));
            found = true;
          }
        }
      }
    },
  });

  if (!found) return { modified: false, error: `Could not locate ${field} inside <Helmet> component` };

  const output = ms.toString();
  try { parse(output); } catch {
    return { modified: false, error: "Post-edit parse validation failed — aborting to avoid committing invalid code" };
  }

  return { modified: true, content: output, filePath: "" };
}

// React Helmet app file paths — check src/pages/ first, fall back to src/App
export function getReactHelmetFilePaths(pageUrl: string, subPath?: string): string[] {
  const prefix = subPath ? `${subPath.replace(/\/$/, "")}/` : "";
  const pathname = (() => {
    try { return new URL(pageUrl).pathname; } catch { return pageUrl; }
  })().replace(/^\//, "").replace(/\/$/, "");

  const slug = pathname || "index";
  const exts = ["tsx", "jsx", "ts", "js"];

  return [
    // pages/ directory (Next.js-style or CRA with react-app-rewired)
    ...exts.map((e) => `${prefix}src/pages/${slug}.${e}`),
    ...exts.map((e) => `${prefix}src/pages/${slug}/index.${e}`),
    // CRA single-app fallback — only for homepage
    ...(slug === "index" ? exts.map((e) => `${prefix}src/App.${e}`) : []),
  ];
}
