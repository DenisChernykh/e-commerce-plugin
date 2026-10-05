import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Preserve one canonical workspace; export only source and the matching built artifact.
// Never copy credentials, local databases, environment files, browser data or node_modules.
const root = fileURLToPath(new URL("../../", import.meta.url));
const target = resolve(root, ".sites-export");
await mkdir(target, { recursive: true });
for (const entry of await readdir(target))
  if (entry !== ".git") await rm(resolve(target, entry), { recursive: true, force: true });
const excluded = new Set([
  "node_modules",
  ".next",
  ".wrangler",
  ".vercel",
  ".seed",
  "dist",
  "dist-chatgpt",
  "coverage",
  "artifacts",
  ".DS_Store",
]);
const filter = (path) =>
  !excluded.has(basename(path)) &&
  (!basename(path).startsWith(".env") || basename(path) === ".env.example") &&
  (!basename(path).startsWith(".dev.vars") || basename(path) === ".dev.vars.example") &&
  !path.endsWith(".tsbuildinfo");
for (const entry of [
  "backend",
  "frontend",
  "chatgpt",
  "scripts",
  "docs",
  ".github",
  ".gitignore",
  ".nvmrc",
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "README.md",
]) {
  await cp(resolve(root, entry), resolve(target, entry), { recursive: true, filter });
}
await mkdir(resolve(target, ".openai"), { recursive: true });
await cp(resolve(root, "chatgpt/.openai/hosting.json"), resolve(target, ".openai/hosting.json"));
await cp(resolve(root, "chatgpt/dist"), resolve(target, "dist"), { recursive: true });
const manifest = JSON.parse(await readFile(resolve(target, "package.json"), "utf8"));
manifest.scripts.build = "pnpm chatgpt:build && node chatgpt/scripts/stage-sites.mjs";
await writeFile(resolve(target, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify({ checkout: target, artifact: resolve(target, "dist/server/index.js") }),
);
