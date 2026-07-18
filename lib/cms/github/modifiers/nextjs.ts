import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import MagicString from "magic-string";
import type { Node, StringLiteral, ObjectProperty, ObjectExpression } from "@babel/types";

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

function extractFilePath(pageUrl: string, base: string, router: "app" | "pages", subPath?: string): string[] {
  const pathname = (() => {
    try { return new URL(pageUrl).pathname; } catch { return pageUrl; }
  })();
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);
  const prefix = subPath ? `${subPath}/` : "";

  const exts = ["tsx", "jsx", "ts", "js"];
  if (router === "app") {
    const dir = segments.length === 0 ? "app" : `app/${segments.join("/")}`;
    return exts.map((e) => `${prefix}${dir}/page.${e}`);
  } else {
    const file = segments.length === 0 ? "index" : segments.join("/");
    return exts.map((e) => `${prefix}pages/${file}.${e}`);
  }
}

// App Router: find `export const metadata = { title: "...", description: "..." }`
export function modifyAppRouterMetadata(
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
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (decl?.type !== "VariableDeclaration") return;
      for (const declarator of decl.declarations) {
        if (
          declarator.id.type !== "Identifier" ||
          declarator.id.name !== "metadata"
        ) continue;

        const init = declarator.init;
        if (!init || init.type !== "ObjectExpression") continue;

        const targetKey = field === "meta_title" ? "title" : "description";
        patchMetadataObject(init, targetKey, newValue, ms);
        found = true;
      }
    },
  });

  if (!found) return { modified: false, error: "Could not locate metadata export in this file" };

  const output = ms.toString();
  try { parse(output); } catch {
    return { modified: false, error: "Post-edit parse validation failed — aborting to avoid committing invalid code" };
  }

  return { modified: true, content: output, filePath: "" };
}

function patchMetadataObject(
  obj: ObjectExpression,
  key: string,
  value: string,
  ms: MagicString,
): boolean {
  for (const prop of obj.properties) {
    if (prop.type !== "ObjectProperty") continue;
    const k = prop.key;
    const propKey = k.type === "Identifier" ? k.name : k.type === "StringLiteral" ? k.value : null;
    if (propKey !== key) continue;

    const val = prop.value as Node;

    if (val.type === "StringLiteral") {
      ms.overwrite(val.start!, val.end!, JSON.stringify(value));
      return true;
    }

    // { absolute: "..." } shape
    if (val.type === "ObjectExpression") {
      for (const inner of val.properties) {
        if (inner.type !== "ObjectProperty") continue;
        const ik = inner.key;
        const innerKey = ik.type === "Identifier" ? ik.name : null;
        if (innerKey !== "absolute") continue;
        if ((inner.value as Node).type === "StringLiteral") {
          ms.overwrite((inner.value as StringLiteral).start!, (inner.value as StringLiteral).end!, JSON.stringify(value));
          return true;
        }
      }
      return false;
    }

    // Template literal or dynamic — cannot modify
    return false;
  }
  return false;
}

// Pages Router: find <Head> component, update <title> or <meta name="description">
export function modifyPagesRouterHead(
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
      if (opening.name.type !== "JSXIdentifier" || opening.name.name !== "Head") return;

      for (const child of path.node.children) {
        if (child.type !== "JSXElement") continue;
        const co = child.openingElement;

        if (field === "meta_title" && co.name.type === "JSXIdentifier" && co.name.name === "title") {
          // Update text content of <title>...</title>
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

        if (field === "meta_description" && co.name.type === "JSXIdentifier" && co.name.name === "meta") {
          const nameAttr = co.attributes.find(
            (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "name"
              && a.value?.type === "StringLiteral" && a.value.value === "description",
          );
          if (!nameAttr) continue;
          const contentAttr = co.attributes.find(
            (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "content",
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

  if (!found) return { modified: false, error: `Could not locate ${field} in <Head> component` };

  const output = ms.toString();
  try { parse(output); } catch {
    return { modified: false, error: "Post-edit parse validation failed — aborting to avoid committing invalid code" };
  }

  return { modified: true, content: output, filePath: "" };
}

export function getNextjsFilePaths(
  pageUrl: string,
  router: "nextjs-app" | "nextjs-pages",
  subPath?: string,
): string[] {
  const sub = subPath?.replace(/\/$/, "") ?? "";
  const r = router === "nextjs-app" ? "app" : "pages";
  return extractFilePath(pageUrl, "", r, sub);
}
