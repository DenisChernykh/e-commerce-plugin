import { spawn } from "node:child_process";

const children = ["dev:api", "dev:ui"].map((script) =>
  spawn("pnpm", [script], { stdio: "inherit" }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
