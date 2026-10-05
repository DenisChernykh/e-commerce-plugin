import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createWorker } from "./worker";

function request(method: string, params: Record<string, unknown> = {}) {
  return new Request("https://mcp.test/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}
test("backend outage and malformed backend JSON are errors, never empty products", async () => {
  for (const fetchBackend of [
    async () => new Response("Down", { status: 503 }),
    async () => new Response("{broken"),
    async () => Response.json({ items: [] }),
    async () => {
      throw new Error("network");
    },
  ]) {
    const response = await createWorker(fetchBackend).fetch(
      request("tools/call", { name: "search_products", arguments: {} }),
      {},
    );
    const payload = (await response.json()) as {
      result: {
        isError: boolean;
        structuredContent: Record<string, unknown>;
        content: { text: string }[];
      };
    };
    assert.equal(payload.result.isError, true);
    assert.equal(payload.result.structuredContent.data, undefined);
    assert.ok(payload.result.structuredContent.error);
  }
});
test("rejects foreign origins, oversized requests and unknown endpoints", async () => {
  const worker = createWorker();
  const foreign = request("tools/list");
  foreign.headers.set("Origin", "https://untrusted.test");
  assert.equal((await worker.fetch(foreign, {})).status, 403);
  assert.equal(
    (
      await worker.fetch(
        new Request("https://mcp.test/mcp", { method: "POST", body: "x".repeat(65537) }),
        {},
      )
    ).status,
    413,
  );
  assert.equal((await worker.fetch(new Request("https://mcp.test/admin"), {})).status, 404);
});
test("packaged skill is actually supplied as instructions and resource", async () => {
  const skill = await readFile(
    new URL("../plugin/skills/catalog-selection/SKILL.md", import.meta.url),
    "utf8",
  );
  const worker = createWorker(fetch, "<html>UI</html>", skill);
  const init = (await (
    await worker.fetch(
      request("initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      }),
      {},
    )
  ).json()) as { result: { instructions: string } };
  assert.ok(init.result.instructions.includes("Соблюдай язык, формат и объём"));
  const resource = (await (
    await worker.fetch(
      request("resources/read", { uri: "skill://tiho/catalog-selection/SKILL.md" }),
      {},
    )
  ).json()) as { result: { contents: { text: string }[] } };
  assert.equal(resource.result.contents[0].text, skill);
});
