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
    // All @azure/* packages must NOT be bundled: they use createRequire(import.meta.url) for
    // native addon loading (e.g. NativeCRC64 in @azure/storage-queue). esbuild's CJS shim sets
    // import.meta.url = undefined → createRequire(undefined) throws ERR_INVALID_ARG_VALUE at
    // module load, aborting GRPC function registration → host sees 0 functions.
    "@azure/*",
    // applicationinsights must NOT be bundled: it's a CJS module compiled with __esModule:true
    // but no default export. When bundled and imported as default, import.default is undefined.
    // Additionally it patches Node.js module internals and must load as a real package.
    "applicationinsights",
    // Native addon — cannot be bundled
    "pg-native",
    // Pi-only providers — not installed in Azure, loaded only if env flags select them
    "bullmq",
    "ioredis",
    // Optional notification providers not provisioned in Azure deployment
    "@sendgrid/mail",
    "@aws-sdk/client-sesv2",
    "twilio",
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
