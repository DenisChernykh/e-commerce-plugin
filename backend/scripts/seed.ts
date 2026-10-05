import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { seedStatements } from "../seed/sql";

const mode = process.argv[2];
if (mode !== "--local" && mode !== "--remote")
  throw new Error("Specify --local or --remote explicitly");
await mkdir(".seed", { recursive: true });
await writeFile(".seed/catalog.sql", `${seedStatements().join("\n")}\n`);
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "tiho-catalog",
    mode,
    ...(mode === "--remote" ? ["--env", "production"] : []),
    "--file",
    ".seed/catalog.sql",
  ],
  { stdio: ["inherit", "pipe", "inherit"], encoding: "utf8" },
);
if (result.status === 0)
  console.log(`Seed complete (${mode}): 72 products, 6 categories, 6 brands.`);
else console.error(result.stdout);
process.exitCode = result.status ?? 1;
