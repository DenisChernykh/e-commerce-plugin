import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src");
const violations = [];
async function files(directory) {
  return (
    await Promise.all(
      (
        await readdir(directory, { withFileTypes: true })
      ).map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? files(target) : entry.name.endsWith(".ts") ? [target] : [];
      }),
    )
  ).flat();
}
for (const file of await files(root)) {
  if (file.endsWith(".d.ts")) continue;
  const relative = path.relative(root, file).split(path.sep);
  const [, moduleName, layer] = relative;
  for (const match of (await readFile(file, "utf8")).matchAll(
    /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/gu,
  )) {
    const specifier = match[1];
    const target = specifier.startsWith(".")
      ? path.relative(root, path.resolve(path.dirname(file), specifier)).split(path.sep)
      : [];
    const fail = (message) =>
      violations.push(`${path.relative(root, file)}: ${message} (${specifier})`);
    if (relative[0] === "modules") {
      if (
        layer === "domain" &&
        !(target[0] === "modules" && target[1] === moduleName && target[2] === "domain") &&
        !(target[0] === "shared" && target[1] === "domain")
      )
        fail("Domain must remain pure");
      if (
        layer === "application" &&
        (!specifier.startsWith(".") ||
          ["infrastructure", "presentation"].includes(target[2]) ||
          target[0] === "platform")
      )
        fail("Application must depend on domain and ports");
      if (layer === "presentation" && target[2] === "infrastructure")
        fail("Presentation must use application queries");
      if (
        target[0] === "modules" &&
        target[1] !== moduleName &&
        target.length > 2 &&
        !["index", "public-contracts"].includes(target[2])
      )
        fail("Use module public API");
    }
    if (
      relative[0] === "app" &&
      target[0] === "modules" &&
      target.length > 2 &&
      target[2] !== "index"
    )
      fail("App must use module factory");
    if (["shared", "platform"].includes(relative[0]) && target[0] === "modules")
      fail("Platform/shared must not import modules");
  }
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else console.log("Backend module boundaries OK");
