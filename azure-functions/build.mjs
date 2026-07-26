import * as esbuild from "esbuild";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { existsSync, statSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];

function isFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

function resolveWithExtensions(base) {
  // Try as-is first (already has a real file extension like .ts)
  if (isFile(base)) return base;
  // Try appending TS extensions (handles foo.handler → foo.handler.ts, lib/db → lib/db/index.ts)
  for (const ext of TS_EXTENSIONS) {
    const candidate = base + ext;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  outfile: "dist/index.js",
  // Never bundle npm packages into a Node.js server binary. Azure Functions has a real
  // node_modules at runtime. Bundling breaks packages that do runtime module patching
  // (@azure/functions, applicationinsights), lazy require(), or native addon loading.
  // The deploy step runs `npm install --production` to ship the full node_modules.
  packages: "external",
  tsconfig: "tsconfig.json",
  plugins: [
    {
      name: "path-alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const base = resolve(projectRoot, args.path.slice(2));
          const resolved = resolveWithExtensions(base);
          if (!resolved) return null;
          return { path: resolved };
        });
      },
    },
  ],
});

console.log("Build complete → dist/index.js");
