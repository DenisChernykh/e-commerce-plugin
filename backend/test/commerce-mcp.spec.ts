import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { searchOutput } from "../../chatgpt/src/schemas";
import { createWorker } from "../../chatgpt/src/worker";
import { createApp } from "../src/app/create-app";
import {
  attemptSchema,
  cartSchema,
  orderSchema,
  quoteSchema,
} from "../src/modules/commerce/public-contracts";

const secret = "isolated-test-credential-with-no-external-authority";
const app = createApp();
const bindings = { ...env, TIHO_MCP_SECRET: secret };
const worker = createWorker(async (input, init) => app.fetch(new Request(input, init), bindings));
async function call(user: string | null, name: string, args: Record<string, unknown> = {}) {
  const response = await worker.fetch(
    new Request("https://private-site.test/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(user ? { "oai-authenticated-user-id": user } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
    { MCP_AUTH_MODE: "sites", TIHO_MCP_SECRET: secret },
  );
  return (await response.json()) as {
    result: {
      isError?: boolean;
      structuredContent: { data: unknown; error?: { code: string } };
      content: { text: string }[];
      _meta?: { storeLink?: string };
    };
  };
}

describe("MCP shopping over HTTP and migrated D1", () => {
  it("runs search → positional add → repeated action → checkout → payment → saved order", async () => {
    const user = crypto.randomUUID();
    const search = searchOutput.parse(
      (
        await call(user, "search_products", {
          changes: {
            category: "candles",
            availability: "in_stock",
            priceTo: 3000,
            sort: "price_asc",
          },
        })
      ).result.structuredContent.data,
    );
    const operationId = crypto.randomUUID();
    const add = {
      action: "add",
      product: { selection: search.selection, position: 2 },
      quantity: 2,
      operationId,
    };
    const first = cartSchema.parse(
      (await call(user, "update_cart", add)).result.structuredContent.data,
    );
    expect(first.items[0]?.productId).toBe(search.items[1]?.id);
    expect(
      cartSchema.parse((await call(user, "update_cart", add)).result.structuredContent.data),
    ).toEqual(first);
    const second = cartSchema.parse(
      (await call(user, "update_cart", { ...add, operationId: crypto.randomUUID() })).result
        .structuredContent.data,
    );
    expect(second.itemCount).toBe(4);
    const changed = cartSchema.parse(
      (
        await call(user, "update_cart", {
          action: "set",
          productId: first.items[0]!.productId,
          quantity: 3,
          operationId: crypto.randomUUID(),
        })
      ).result.structuredContent.data,
    );
    await call(user, "update_cart", {
      action: "add",
      productId: search.items[0]!.id,
      quantity: 1,
      operationId: crypto.randomUUID(),
    });
    const removed = cartSchema.parse(
      (
        await call(user, "update_cart", {
          action: "remove",
          productId: search.items[0]!.id,
          operationId: crypto.randomUUID(),
        })
      ).result.structuredContent.data,
    );
    expect(removed.totalMinor).toBe(changed.totalMinor);
    const quote = quoteSchema.parse(
      (
        await call(user, "prepare_checkout", {
          cartVersion: removed.version,
          customer: { name: "Покупатель из чата", email: "chat@example.test" },
        })
      ).result.structuredContent.data,
    );
    const create = { quoteId: quote.id, operationId: crypto.randomUUID() };
    const order = orderSchema.parse(
      (await call(user, "create_order", create)).result.structuredContent.data,
    );
    expect(order.customer).toEqual(quote.customer);
    expect(
      orderSchema.parse((await call(user, "create_order", create)).result.structuredContent.data)
        .id,
    ).toBe(order.id);
    expect(
      (await call(crypto.randomUUID(), "get_order", { orderId: order.id })).result.structuredContent
        .error?.code,
    ).toBe("NOT_FOUND");
    const payment = attemptSchema.parse(
      (await call(user, "start_payment", { orderId: order.id, operationId: crypto.randomUUID() }))
        .result.structuredContent.data,
    );
    expect(["pending", "processing"]).toContain(payment.status);
    await env.DB.prepare("UPDATE commerce_attempts SET ready_at=0 WHERE id=?")
      .bind(payment.id)
      .run();
    expect(
      attemptSchema.parse(
        (await call(user, "get_payment", { attemptId: payment.id })).result.structuredContent.data,
      ).status,
    ).toBe("succeeded");
    expect(
      orderSchema.parse(
        (await call(user, "get_order", { orderId: order.id })).result.structuredContent.data,
      ).paymentStatus,
    ).toBe("completed");
    const visual = (await call(user, "open_checkout", { view: "order", orderId: order.id })).result;
    expect(visual.isError).not.toBe(true);
    expect((visual.structuredContent.data as { order: { id: string } }).order.id).toBe(order.id);
  });
  it("isolates users, requires authenticated identity, rejects model supplied owner/price", async () => {
    const first = cartSchema.parse(
      (await call(crypto.randomUUID(), "get_cart")).result.structuredContent.data,
    );
    const second = cartSchema.parse(
      (await call(crypto.randomUUID(), "get_cart")).result.structuredContent.data,
    );
    expect(first.id).not.toBe(second.id);
    expect((await call(null, "get_cart")).result.structuredContent.error?.code).toBe(
      "SESSION_REQUIRED",
    );
    for (const extra of [{ owner: first.id }, { price: 1 }, { cartId: first.id }])
      expect((await call(crypto.randomUUID(), "get_cart", extra)).result.isError).toBe(true);
  });
  it("links an independent website session to MCP through one-time exchange without model-visible secrets", async () => {
    const user = crypto.randomUUID();
    const cart = cartSchema.parse((await call(user, "get_cart")).result.structuredContent.data);
    const link = (await call(user, "store_link", { target: "/cart" })).result;
    const url = new URL(link._meta!.storeLink!);
    const code = new URLSearchParams(url.hash.slice(1)).get("code")!;
    expect(JSON.stringify(link.content)).not.toContain(code);
    expect(JSON.stringify(link.structuredContent)).not.toContain(code);
    const exchange = await app.request(
      "/api/commerce/session/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
      bindings,
    );
    expect(exchange.status).toBe(200);
    const cookie = exchange.headers.get("Set-Cookie")!.split(";")[0]!;
    const website = await app.request(
      "/api/commerce/cart",
      { headers: { Cookie: cookie } },
      bindings,
    );
    expect(cartSchema.parse(await website.json()).id).toBe(cart.id);
    const replay = await app.request(
      "/api/commerce/session/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
      bindings,
    );
    expect(replay.status).toBe(401);
  });
});
