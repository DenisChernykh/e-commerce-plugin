import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const endpoint = process.env.MCP_URL || "http://127.0.0.1:8790/mcp";
let authorization;
if (process.argv.includes("--sites-auth-stdin")) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdout.write("Ready for Sites authorization on hidden stdin.\n");
  authorization = await new Promise((resolve) => {
    let buffer = "";
    const read = (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\n") && !buffer.includes("\r")) return;
      process.stdin.off("data", read);
      process.stdin.pause();
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      resolve(buffer.trim());
    };
    process.stdin.on("data", read);
  });
}
let id = 0;
const checks = [];
async function rpc(method, params = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(authorization ? { "OAI-Sites-Authorization": `Bearer ${authorization}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  if (response.status !== 200) {
    throw new Error(
      `MCP returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
    );
  }
  const body = await response.json();
  assert.equal(body.error, undefined, JSON.stringify(body.error));
  return body.result;
}
const call = (name, args = {}) => rpc("tools/call", { name, arguments: args });
async function search(args = {}) {
  const result = await call("search_products", args);
  assert.ok(!result.isError, JSON.stringify(result));
  return result.structuredContent.data;
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}
let first;
let uiUri;
await check("initialization, connected instructions, strict read-only tools", async () => {
  const init = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "tiho-live-verification", version: "1" },
  });
  assert.match(init.instructions, /Соблюдай язык, формат и объём/);
  assert.match(init.serverInfo.icons[0].src, /^data:image\/svg\+xml,/);
  const { tools } = await rpc("tools/list");
  uiUri = tools.find((tool) => tool.name === "open_store")._meta.ui.resourceUri;
  assert.equal(tools.length, 6);
  const home = tools.find((tool) => tool.name === "tiho_home");
  assert.deepEqual(home._meta["openai/ui"].entrypoints, [{ type: "global" }]);
  assert.equal(tools.find((tool) => tool.name === "open_store")._meta["openai/ui"], undefined);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(tool.outputSchema);
  }
});
await check("real catalog filters, combined search, preservation and removal", async () => {
  const facets = await call("get_catalog_filters", { category: "candles" });
  assert.ok(facets.structuredContent.data.categories.length);
  first = await search({
    changes: {
      category: "candles,diffusers",
      color: "beige,green",
      priceFrom: 2000,
      priceTo: 3500,
      attribute: "aroma:woody,aroma:fresh",
      sort: "price_asc",
      pageSize: 3,
    },
  });
  assert.ok(first.pagination.total > 1);
  const stock = await search({
    base: first.selection.params,
    changes: { availability: "in_stock" },
  });
  assert.deepEqual(stock.selection.params, { ...first.selection.params, availability: "in_stock" });
  const uncolored = await search({ base: stock.selection.params, changes: { color: null } });
  const expected = { ...stock.selection.params };
  delete expected.color;
  assert.deepEqual(uncolored.selection.params, expected);
  assert.ok(
    uncolored.items.every(
      (p) => p.availability === "in_stock" && p.price >= 2000 && p.price <= 3500,
    ),
  );
});
await check("global price order, exact count and every next page", async () => {
  let page = await search({ changes: { category: "candles", sort: "price_asc", pageSize: 3 } });
  const items = [...page.items];
  const total = page.pagination.total;
  while (page.next) {
    page = await search(page.next);
    assert.equal(page.selection.params.category, "candles");
    assert.equal(page.selection.params.pageSize, 3);
    items.push(...page.items);
  }
  assert.equal(items.length, total);
  assert.deepEqual(
    items.map((p) => p.price),
    items.map((p) => p.price).sort((a, b) => a - b),
  );
  const whole = await search({ changes: { category: "candles", sort: "price_asc", pageSize: 48 } });
  assert.deepEqual(
    items.map((p) => p.id),
    whole.items.map((p) => p.id),
  );
});
await check("exact second item, comparison, canonical link and restored selection", async () => {
  const list = await search({ changes: { category: "candles", pageSize: 3 } });
  await search({ changes: { category: "textiles" } });
  const detail = (await call("get_product", { selection: list.selection, position: 2 }))
    .structuredContent.data;
  assert.equal(detail.product.id, list.items[1].id);
  assert.equal(detail.product.url, `https://tiho-store.vercel.app/products/${detail.product.slug}`);
  const comparison = (await call("get_products", { selection: list.selection, positions: [1, 3] }))
    .structuredContent.data;
  assert.deepEqual(
    comparison.products.map((p) => p.id),
    [list.items[0].id, list.items[2].id],
  );
  assert.ok(comparison.products.every((p) => p.attributes.length));
  const restored = await search({ base: list.selection.params });
  assert.deepEqual(restored.items, list.items);
});
await check(
  "ambiguity, empty results, invalid ID, missing ordinal context and invalid parameters",
  async () => {
    const candidates = await search({ changes: { q: "Олива" } });
    assert.ok(candidates.pagination.total > 1);
    assert.equal((await call("get_product", { identifier: "Олива" })).isError, true);
    const empty = await search({ changes: { q: "несуществующийпредмет" } });
    assert.equal(empty.pagination.total, 0);
    assert.equal(empty.returned, 0);
    assert.equal(empty.next, null);
    assert.equal((await call("get_product", { identifier: "missing-product" })).isError, true);
    assert.equal((await call("get_product", { position: 2 })).isError, true);
    for (const changes of [
      { page: 0 },
      { sort: "wrong" },
      { priceFrom: 5000, priceTo: 100 },
      { typo: true },
    ]) {
      assert.equal((await call("search_products", { changes })).isError, true);
    }
  },
);
await check("real visual tool payload, MCP Apps resource, packaged skill", async () => {
  const home = await call("tiho_home");
  assert.ok(!home.isError);
  assert.ok(home.structuredContent.data.items.length > 0);
  assert.equal(home.structuredContent.data.selection.params.category, undefined);
  const visual = await call("open_store", {
    search: { changes: { category: "candles" } },
    previousSelections: [first.selection],
  });
  assert.equal(visual.structuredContent.data.view, "catalog");
  assert.ok(visual.structuredContent.data.items.every((p) => p.category.slug === "candles"));
  assert.deepEqual(visual.structuredContent.data.previousSelections, [first.selection]);
  const ui = await rpc("resources/read", { uri: uiUri });
  assert.equal(ui.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.ok(ui.contents[0].text.length > 100000);
  const skill = await rpc("resources/read", { uri: "skill://tiho/catalog-selection/SKILL.md" });
  assert.match(skill.contents[0].text, /Соблюдай язык, формат и объём/);
});
const report = {
  endpoint,
  checkedAt: new Date().toISOString(),
  checks,
  example: {
    params: first.selection.params,
    total: first.pagination.total,
    items: first.items.map(({ id, name, price, currency }) => ({ id, name, price, currency })),
  },
};
await mkdir(new URL("../../artifacts/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../../artifacts/live-mcp-verification.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ endpoint, passed: checks.length }));
