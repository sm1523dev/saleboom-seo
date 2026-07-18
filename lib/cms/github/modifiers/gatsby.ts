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

// Gatsby Head API: export function Head() { return <><title>…</title>…</> }
export function modifyGatsbyHead(
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
    // Match both `export function Head()` and `export const Head = () =>`
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      let isHead = false;

      if (decl?.type === "FunctionDeclaration" && decl.id?.name === "Head") {
        isHead = true;
      } else if (decl?.type === "VariableDeclaration") {
        const declarator = decl.declarations[0];
        if (declarator?.id.type === "Identifier" && declarator.id.name === "Head") {
          isHead = true;
        }
      }

      if (!isHead) return;

      // Traverse JSX inside the Head function for <title> and <meta name="description">
      path.traverse({
        JSXElement(inner) {
          const opening = inner.node.openingElement;
          if (opening.name.type !== "JSXIdentifier") return;

          if (field === "meta_title" && opening.name.name === "title") {
            for (const child of inner.node.children) {
              if (child.type === "JSXText") {
                ms.overwrite(child.start!, child.end!, newValue);
                found = true;
              } else if (child.type === "JSXExpressionContainer" && child.expression.type === "StringLiteral") {
                ms.overwrite(child.expression.start!, child.expression.end!, JSON.stringify(newValue));
                found = true;
              }
            }
          }

          if (field === "meta_description" && opening.name.name === "meta") {
            const nameAttr = opening.attributes.find(
              (a) => a.type === "JSXAttribute" &&
                a.name.type === "JSXIdentifier" && a.name.name === "name" &&
                a.value?.type === "StringLiteral" && a.value.value === "description",
            );
            if (!nameAttr) return;
            const contentAttr = opening.attributes.find(
              (a) => a.type === "JSXAttribute" &&
                a.name.type === "JSXIdentifier" && a.name.name === "content",
            );
            if (!contentAttr || contentAttr.type !== "JSXAttribute") return;
            if (contentAttr.value?.type === "StringLiteral") {
              ms.overwrite(contentAttr.value.start!, contentAttr.value.end!, JSON.stringify(newValue));
              found = true;
            }
          }
        },
      });
    },
  });

  if (!found) return { modified: false, error: `Could not locate ${field} in Gatsby Head() export` };

  const output = ms.toString();
  try { parse(output); } catch {
    return { modified: false, error: "Post-edit parse validation failed — aborting to avoid committing invalid code" };
  }

  return { modified: true, content: output, filePath: "" };
}

// Gatsby page files live in src/pages/ (not pages/)
export function getGatsbyFilePaths(pageUrl: string, subPath?: string): string[] {
  const prefix = subPath ? `${subPath.replace(/\/$/, "")}/` : "";
  const pathname = (() => {
    try { return new URL(pageUrl).pathname; } catch { return pageUrl; }
  })().replace(/^\//, "").replace(/\/$/, "");

  const slug = pathname || "index";
  const exts = ["tsx", "jsx", "ts", "js"];

  return [
    ...exts.map((e) => `${prefix}src/pages/${slug}.${e}`),
    ...exts.map((e) => `${prefix}src/pages/${slug}/index.${e}`),
  ];
}
