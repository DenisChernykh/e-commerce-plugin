import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const frontend = spawnSync("pnpm", ["--dir", "../frontend", "build:chatgpt"], { stdio: "inherit" });
if (frontend.status !== 0) process.exit(frontend.status ?? 1);
await rm("dist", { recursive: true, force: true });
await mkdir("dist/.openai", { recursive: true });
let html = await readFile("../frontend/dist-chatgpt/chatgpt.html", "utf8");
const assets = resolve("../frontend/dist-chatgpt");
for (const match of html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/gu)) {
  const javascript = await readFile(resolve(assets, match[1]), "utf8");
  html = html.replace(
    match[0],
    () => `<script type="module">${javascript.replace(/<\/script/giu, "<\\/script")}</script>`,
  );
}
for (const match of html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/gu)) {
  if (!match[0].includes('rel="stylesheet"')) throw new Error("Unexpected external UI asset");
  const css = await readFile(resolve(assets, match[1]), "utf8");
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
if (/(?:src|href)="\.\/assets\//u.test(html)) throw new Error("UI must be self-contained");
await writeFile("dist/ui.html", html);
const skill = await readFile("plugin/skills/catalog-selection/SKILL.md", "utf8");
await build({
  stdin: {
    contents: `import { createWorker } from './src/worker.ts'; export default createWorker(fetch, ${JSON.stringify(html)}, ${JSON.stringify(skill)});`,
    resolveDir: process.cwd(),
    sourcefile: "tiho-worker.ts",
  },
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2024",
  minify: true,
  define: {
    TIHO_UI_HASH: JSON.stringify(createHash("sha256").update(html).digest("hex").slice(0, 16)),
  },
});
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
const packaged = spawnSync(process.execPath, ["scripts/package-plugin.mjs"], { stdio: "inherit" });
if (packaged.status !== 0) process.exit(packaged.status ?? 1);
console.log("TIHO: shared UI and MCP Worker ready");
