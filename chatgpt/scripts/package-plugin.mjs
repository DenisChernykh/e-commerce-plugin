import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../plugin", import.meta.url));
const target = fileURLToPath(
  new URL("../../frontend/public/plugins/tiho-plugin.zip", import.meta.url),
);
await mkdir(fileURLToPath(new URL("../../frontend/public/plugins", import.meta.url)), {
  recursive: true,
});
await rm(target, { force: true });
const result = spawnSync("zip", ["-q", "-r", target, "plugin.json", "mcp.json", "skills"], {
  cwd: directory,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("TIHO plugin package ready");
