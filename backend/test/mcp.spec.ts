import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { productOutput, productsOutput, searchOutput } from "../../chatgpt/src/schemas";
import { createWorker } from "../../chatgpt/src/worker";
import { createApp } from "../src/app/create-app";

const app = createApp();
const worker = createWorker(
  async (input, init) => app.fetch(new Request(input, init), env),
  "<html>TIHO</html>",
  "Test skill",
);
let id = 0;
async function rpc(method: string, params: Record<string, unknown> = {}) {
  const response = await worker.fetch(
    new Request("https://mcp.test/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    }),
    {},
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    result: {
      isError?: boolean;
      structuredContent: { data: unknown };
      content: { text: string }[];
      instructions?: string;
      tools?: {
        name: string;
        annotations: { readOnlyHint: boolean };
        inputSchema: { additionalProperties: boolean };
        outputSchema: unknown;
      }[];
    };
  };
}
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await rpc("tools/call", { name, arguments: args })).result;
async function search(args: Record<string, unknown> = {}) {
  const result = await call("search_products", args);
  expect(result.isError, JSON.stringify(result)).not.toBe(true);
  return searchOutput.parse(result.structuredContent.data);
}

describe("MCP → application API → actual D1", () => {
  it("publishes strict tools with accurate write annotations, instructions and optional UI", async () => {
    const discovery = await rpc("tools/list");
    expect(discovery.result.tools).toHaveLength(16);
    for (const tool of discovery.result.tools ?? []) {
      expect(tool.annotations.readOnlyHint).toBe(
        ![
          "update_cart",
          "prepare_checkout",
          "create_order",
          "start_payment",
          "store_link",
        ].includes(tool.name),
      );
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.outputSchema).toBeDefined();
    }
    const init = await rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.result.instructions).toContain("Test skill");
    const home = await call("tiho_home");
    const homeCatalog = searchOutput.parse(home.structuredContent.data);
    expect(homeCatalog.items.length).toBeGreaterThan(0);
    expect(homeCatalog.selection.params.category).toBeUndefined();
    const visual = await call("open_store", { search: { changes: { category: "candles" } } });
    expect(
      searchOutput
        .parse(visual.structuredContent.data)
        .items.every((p) => p.category.slug === "candles"),
    ).toBe(true);
    const shown = searchOutput.parse(visual.structuredContent.data).selection;
    const continued = await call("open_store", {
      search: { base: shown.params, changes: { availability: "in_stock" } },
      previousSelections: [shown],
    });
    expect(searchOutput.parse(continued.structuredContent.data).previousSelections).toEqual([
      shown,
    ]);
  });

  it("combines filters, preserves them during updates, and clears only the requested field", async () => {
    const first = await search({
      changes: {
        category: "candles,diffusers",
        color: "beige,green",
        priceFrom: 2000,
        priceTo: 3500,
        attribute: "aroma:woody,aroma:fresh",
        sort: "price_asc",
      },
    });
    expect(first.pagination.total).toBeGreaterThan(1);
    const stock = await search({
      base: first.selection.params,
      changes: { availability: "in_stock" },
    });
    expect(stock.selection.params).toMatchObject({
      ...first.selection.params,
      availability: "in_stock",
    });
    expect(
      stock.items.every((p) => p.availability === "in_stock" && p.price >= 2000 && p.price <= 3500),
    ).toBe(true);
    const uncolored = await search({ base: stock.selection.params, changes: { color: null } });
    expect(uncolored.selection.params.color).toBeUndefined();
    expect(uncolored.selection.params).toMatchObject({
      category: "candles,diffusers",
      priceFrom: 2000,
      priceTo: 3500,
      availability: "in_stock",
      attribute: "aroma:woody,aroma:fresh",
    });
  });

  it("sorts the entire matching set before pagination and preserves page conditions", async () => {
    let page = await search({ changes: { category: "candles", sort: "price_asc", pageSize: 3 } });
    const all = [...page.items];
    const first = page;
    while (page.next) {
      page = await search(page.next);
      all.push(...page.items);
      expect(page.selection.params.category).toBe("candles");
    }
    expect(all).toHaveLength(first.pagination.total);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(all.map((p) => p.price)).toEqual(all.map((p) => p.price).sort((a, b) => a - b));
    const whole = await search({
      changes: { category: "candles", sort: "price_asc", pageSize: 48 },
    });
    expect(all.map((p) => p.id)).toEqual(whole.items.map((p) => p.id));
    expect(
      (await search({ base: page.selection.params, changes: { color: "beige" } })).selection.params
        .page,
    ).toBe(1);
    const restored = await search({ base: first.selection.params });
    expect(restored.items).toEqual(first.items);
  });

  it("uses the shown selection for ordinals and comparisons, including after another search", async () => {
    const list = await search({ changes: { category: "candles", pageSize: 3 } });
    await search({ changes: { category: "textiles" } });
    const details = productOutput.parse(
      (await call("get_product", { selection: list.selection, position: 2 })).structuredContent
        .data,
    );
    expect(details.product.id).toBe(list.items[1]?.id);
    expect(details.selection).toEqual(list.selection);
    expect(details.product.url).toBe(
      `https://tiho-store.vercel.app/products/${details.product.slug}`,
    );
    const comparison = productsOutput.parse(
      (await call("get_products", { selection: list.selection, positions: [1, 3] }))
        .structuredContent.data,
    );
    expect(comparison.products.map((p) => p.id)).toEqual([list.items[0]?.id, list.items[2]?.id]);
    expect(comparison.products.every((p) => p.attributes.length > 0)).toBe(true);
  });

  it("keeps ambiguous names as candidates and does not resolve to the first item", async () => {
    const candidates = await search({ changes: { q: "Олива" } });
    expect(candidates.pagination.total).toBeGreaterThan(1);
    expect((await call("get_product", { identifier: "Олива" })).isError).toBe(true);
  });

  it("distinguishes empty results, missing products and malformed parameters", async () => {
    const empty = await search({ changes: { q: "несуществующийпредмет" } });
    expect(empty.items).toEqual([]);
    expect(empty.pagination.total).toBe(0);
    expect(empty.next).toBeNull();
    expect((await call("get_product", { identifier: "missing" })).isError).toBe(true);
    for (const args of [
      { changes: { page: 0 } },
      { changes: { priceFrom: 5000, priceTo: 100 } },
      { changes: { typo: "x" } },
      { changes: { sort: "wrong" } },
    ])
      expect((await call("search_products", args)).isError).toBe(true);
    expect((await call("get_product", { position: 2 })).isError).toBe(true);
    const list = await search({ changes: { pageSize: 1 } });
    expect((await call("get_product", { selection: list.selection, position: 2 })).isError).toBe(
      true,
    );
  });
});
