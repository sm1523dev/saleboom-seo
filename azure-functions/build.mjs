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
  external: [
    "pg-native",
    "@azure/functions-core",
    // Must not be bundled — patches Node http/https/pg at startup
    "applicationinsights",
    // Optional notification providers not used in Azure deployment
    "@sendgrid/mail",
    "@aws-sdk/client-sesv2",
    "twilio",
    // Pi-only queue provider
    "bullmq",
    "ioredis",
  ],
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
