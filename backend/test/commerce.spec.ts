import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app/create-app";
import { CommerceService } from "../src/modules/commerce/application/commerce-service";
import { SessionService } from "../src/modules/commerce/application/session-service";
import { D1CommerceRepository } from "../src/modules/commerce/infrastructure/d1-commerce-repository";
import { D1SessionStore } from "../src/modules/commerce/infrastructure/d1-session-store";

const customer = { name: "Тестовый покупатель", email: "shopper@example.test" };
const repository = () => new D1CommerceRepository(env.DB);
const service = (outcome: "success" | "failure" | "fail_once" = "success", delayMs = 0) =>
  new CommerceService(repository(), { enabled: true, outcome, delayMs });
async function products() {
  return (
    await env.DB.prepare(
      "SELECT id,price_kopecks FROM products WHERE availability='in_stock' ORDER BY id LIMIT 2",
    ).all<{ id: string; price_kopecks: number }>()
  ).results;
}
async function filled() {
  const owner = crypto.randomUUID();
  const [product] = await products();
  const cart = await service().change(owner, {
    action: "add",
    productId: product!.id,
    quantity: 2,
    operationId: crypto.randomUUID(),
  });
  return { owner, cart, product: product! };
}
async function placed() {
  const state = await filled();
  const quote = await service().prepare(state.owner, state.cart.version, customer);
  const order = await service().createOrder(state.owner, quote.id, crypto.randomUUID());
  return { ...state, quote, order };
}

describe("Commerce on migrated D1 and actual catalogue", () => {
  it("persists cart, exact totals, separate additions, mutations and isolated owners", async () => {
    const { owner, cart, product } = await filled();
    const input = {
      action: "add" as const,
      productId: product.id,
      quantity: 1,
      operationId: crypto.randomUUID(),
    };
    const added = await service().change(owner, input);
    expect(added.itemCount).toBe(3);
    expect(await service().change(owner, input)).toEqual(added);
    expect((await service().cart(owner)).totalMinor).toBe(product.price_kopecks * 3);
    expect((await service().cart(crypto.randomUUID())).items).toEqual([]);
    const set = await service().change(owner, {
      ...input,
      action: "set",
      quantity: 4,
      operationId: crypto.randomUUID(),
    });
    expect(set.itemCount).toBe(4);
    const [, other] = await products();
    await service().change(owner, {
      ...input,
      productId: other!.id,
      operationId: crypto.randomUUID(),
    });
    const removed = await service().change(owner, {
      action: "remove",
      productId: other!.id,
      operationId: crypto.randomUUID(),
    });
    expect(removed.totalMinor).toBe(product.price_kopecks * 4);
    const cleared = await service().change(owner, {
      action: "clear",
      operationId: crypto.randomUUID(),
    });
    expect(cleared.itemCount).toBe(0);
    expect(cart.id).toBe(cleared.id);
    await expect(service().prepare(owner, cleared.version, customer)).rejects.toMatchObject({
      code: "EMPTY_CART",
    });
  });
  it("rejects invalid quantities, missing or unavailable products and intent reuse", async () => {
    const { owner, product } = await filled();
    for (const quantity of [0, -1, 1.5, 100])
      await expect(
        service().change(owner, {
          action: "add",
          productId: product.id,
          quantity,
          operationId: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    await expect(
      service().change(owner, {
        action: "add",
        productId: crypto.randomUUID(),
        quantity: 1,
        operationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    const unavailable = await env.DB.prepare(
      "SELECT id FROM products WHERE availability='out_of_stock' LIMIT 1",
    ).first<{ id: string }>();
    await expect(
      service().change(owner, {
        action: "add",
        productId: unavailable!.id,
        quantity: 1,
        operationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
    const operationId = crypto.randomUUID();
    await service().change(owner, {
      action: "add",
      productId: product.id,
      quantity: 1,
      operationId,
    });
    await expect(
      service().change(owner, { action: "add", productId: product.id, quantity: 2, operationId }),
    ).rejects.toMatchObject({ code: "INTENT_CONFLICT" });
  });
  it("serializes concurrent additions and repeated delivery", async () => {
    const { owner, product } = await filled();
    const action = {
      action: "add" as const,
      productId: product.id,
      quantity: 1,
      operationId: crypto.randomUUID(),
    };
    await Promise.all([service().change(owner, action), service().change(owner, action)]);
    expect((await service().cart(owner)).itemCount).toBe(3);
    await Promise.all([
      service().change(owner, { ...action, operationId: crypto.randomUUID() }),
      service().change(owner, { ...action, operationId: crypto.randomUUID() }),
    ]);
    expect((await service().cart(owner)).itemCount).toBe(5);
  });
  it("rejects price and cart changes before confirmation; snapshots remain immutable", async () => {
    const { owner, cart, product } = await filled();
    const quote = await service().prepare(owner, cart.version, customer);
    await env.DB.prepare("UPDATE products SET price_kopecks=price_kopecks+1 WHERE id=?")
      .bind(product.id)
      .run();
    try {
      await expect(
        service().createOrder(owner, quote.id, crypto.randomUUID()),
      ).rejects.toMatchObject({ code: "CART_CHANGED" });
      expect((await service().cart(owner)).totalMinor).toBe((product.price_kopecks + 1) * 2);
    } finally {
      await env.DB.prepare("UPDATE products SET price_kopecks=? WHERE id=?")
        .bind(product.price_kopecks, product.id)
        .run();
    }
    const fresh = await service().cart(owner);
    const freshQuote = await service().prepare(owner, fresh.version, customer);
    await service().change(owner, {
      action: "add",
      productId: product.id,
      quantity: 1,
      operationId: crypto.randomUUID(),
    });
    await expect(
      service().createOrder(owner, freshQuote.id, crypto.randomUUID()),
    ).rejects.toMatchObject({ code: "CART_CHANGED" });
    const current = await service().cart(owner);
    const order = await service().createOrder(
      owner,
      (await service().prepare(owner, current.version, customer)).id,
      crypto.randomUUID(),
    );
    await env.DB.prepare("UPDATE products SET price_kopecks=price_kopecks+100 WHERE id=?")
      .bind(product.id)
      .run();
    try {
      expect((await service().order(owner, order.id)).totalMinor).toBe(product.price_kopecks * 3);
    } finally {
      await env.DB.prepare("UPDATE products SET price_kopecks=? WHERE id=?")
        .bind(product.price_kopecks, product.id)
        .run();
    }
  });
  it("rejects availability changes after review and preserves the cart for correction", async () => {
    const { owner, cart, product } = await filled();
    const quote = await service().prepare(owner, cart.version, customer);
    await env.DB.prepare("UPDATE products SET availability='out_of_stock' WHERE id=?")
      .bind(product.id)
      .run();
    try {
      const changed = await service().cart(owner);
      expect(changed.items[0]?.available).toBe(false);
      expect(changed.items[0]?.quantity).toBe(2);
      expect(changed.changes).toContain(`Наличие «${cart.items[0]?.name}» изменилось.`);
      await expect(
        service().createOrder(owner, quote.id, crypto.randomUUID()),
      ).rejects.toMatchObject({
        code: "CART_CHANGED",
      });
      await expect(service().prepare(owner, changed.version, customer)).rejects.toMatchObject({
        code: "UNAVAILABLE",
      });
      expect(await service().orders(owner)).toEqual([]);
    } finally {
      await env.DB.prepare("UPDATE products SET availability='in_stock' WHERE id=?")
        .bind(product.id)
        .run();
    }
  });
  it("refuses expired confirmation and disabled checkout without losing server data", async () => {
    const { owner, cart } = await filled();
    const quote = await service().prepare(owner, cart.version, customer);
    const expired = { ...quote, id: crypto.randomUUID(), expiresAt: "2000-01-01T00:00:00.000Z" };
    await repository().saveQuote(owner, expired);
    await expect(
      service().createOrder(owner, expired.id, crypto.randomUUID()),
    ).rejects.toMatchObject({
      code: "QUOTE_EXPIRED",
    });
    const disabled = new CommerceService(repository(), {
      enabled: false,
      outcome: "success",
      delayMs: 0,
    });
    await expect(disabled.createOrder(owner, quote.id, crypto.randomUUID())).rejects.toMatchObject({
      code: "CHECKOUT_UNAVAILABLE",
    });
    expect(await service().cart(owner)).toEqual(cart);
    expect(await service().orders(owner)).toEqual([]);
    const order = await service().createOrder(owner, quote.id, crypto.randomUUID());
    await expect(disabled.pay(owner, order.id, crypto.randomUUID())).rejects.toMatchObject({
      code: "PAYMENT_UNAVAILABLE",
    });
    expect((await service().order(owner, order.id)).attempt).toBeNull();
  });
  it("creates one order for timeout, double click and competing quotes of one version", async () => {
    const { owner, cart } = await filled();
    const quote = await service().prepare(owner, cart.version, customer);
    const quote2 = await service().prepare(owner, cart.version, customer);
    const operationId = crypto.randomUUID();
    const orders = await Promise.all([
      service().createOrder(owner, quote.id, operationId),
      service().createOrder(owner, quote.id, operationId),
      service().createOrder(owner, quote2.id, crypto.randomUUID()),
    ]);
    expect(new Set(orders.map((o) => o.id)).size).toBe(1);
    expect((await service().createOrder(owner, quote.id, operationId)).id).toBe(orders[0]!.id);
    expect((await service().cart(owner)).items).toEqual([]);
    await expect(service().order(crypto.randomUUID(), orders[0]!.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("rolls back a storage failure and preserves the cart", async () => {
    const { owner, cart } = await filled();
    const quote = await service().prepare(owner, cart.version, customer);
    await env.DB.exec(
      "CREATE TRIGGER reject_order BEFORE INSERT ON commerce_orders BEGIN SELECT RAISE(ABORT, 'injected storage failure'); END;",
    );
    try {
      await expect(service().createOrder(owner, quote.id, crypto.randomUUID())).rejects.toThrow();
      expect(await service().cart(owner)).toEqual(cart);
      expect(await service().orders(owner)).toEqual([]);
    } finally {
      await env.DB.exec("DROP TRIGGER reject_order;");
    }
  });
  it("does not erase additions concurrent with checkout", async () => {
    const { owner, cart } = await filled();
    const [, product] = await products();
    const quote = await service().prepare(owner, cart.version, customer);
    await Promise.allSettled([
      service().createOrder(owner, quote.id, crypto.randomUUID()),
      service().change(owner, {
        action: "add",
        productId: product!.id,
        quantity: 1,
        operationId: crypto.randomUUID(),
      }),
    ]);
    expect(
      (await service().cart(owner)).items.find((line) => line.productId === product!.id)?.quantity,
    ).toBe(1);
  });
  it("persists attempts, fails once, retries same order and never reports real settlement", async () => {
    const { owner, order } = await placed();
    const operationId = crypto.randomUUID();
    const attempt = await service("fail_once").pay(owner, order.id, operationId);
    expect(attempt.status).toBe("pending");
    expect((await service().attempt(owner, attempt.id)).status).toBe("failed");
    expect((await service().pay(owner, order.id, operationId)).id).toBe(attempt.id);
    const next = await service("fail_once").pay(owner, order.id, crypto.randomUUID());
    expect(next.id).not.toBe(attempt.id);
    expect((await service().attempt(owner, next.id)).status).toBe("succeeded");
    expect((await service().order(owner, order.id)).paymentStatus).toBe("completed");
    expect((await service().pay(owner, order.id, crypto.randomUUID())).id).toBe(next.id);
    const internal = await env.DB.prepare("SELECT status,outcome FROM commerce_attempts WHERE id=?")
      .bind(next.id)
      .first();
    expect(internal).toEqual({ status: "internal_succeeded", outcome: "internal_succeeded" });
    await expect(service().attempt(crypto.randomUUID(), next.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("reopens a processing payment after a new service instance and avoids concurrent attempts", async () => {
    const { owner, order } = await placed();
    const [a, b] = await Promise.all([
      service("success", 10000).pay(owner, order.id, crypto.randomUUID()),
      service("success", 10000).pay(owner, order.id, crypto.randomUUID()),
    ]);
    expect(a.id).toBe(b.id);
    expect((await service().order(owner, order.id)).paymentStatus).toBe("processing");
    await env.DB.prepare("UPDATE commerce_attempts SET ready_at=0 WHERE id=?").bind(a.id).run();
    expect((await service().order(owner, order.id)).paymentStatus).toBe("completed");
  });
  it("exchanges a one-use link atomically and shares only the proven owner's cart", async () => {
    const { owner, cart } = await filled();
    const sessions = new SessionService(new D1SessionStore(env.DB));
    const link = await sessions.link(owner, "/cart");
    const results = await Promise.allSettled([
      sessions.exchange(link.code),
      sessions.exchange(link.code),
    ]);
    const success = results.find((r) => r.status === "fulfilled");
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    if (success?.status !== "fulfilled") throw new Error("No session");
    const linkedOwner = await sessions.owner(success.value.token);
    expect(await service().cart(linkedOwner)).toEqual(cart);
    await expect(sessions.owner(cart.id)).rejects.toMatchObject({ code: "SESSION_REQUIRED" });
  });
  it("HTTP requires session, strict inputs and same-origin writes", async () => {
    const app = createApp();
    const get = await app.request("/api/commerce/cart", {}, env);
    expect(get.status).toBe(401);
    const session = await app.request(
      "/api/commerce/session",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      env,
    );
    expect(session.status).toBe(200);
    const cookie = session.headers.get("Set-Cookie")!.split(";")[0]!;
    expect(session.headers.get("Set-Cookie")).toContain("HttpOnly");
    const headers = { "Content-Type": "application/json", Cookie: cookie };
    const cart = await app.request("/api/commerce/cart", { headers }, env);
    expect(cart.status).toBe(200);
    expect(cart.headers.get("Cache-Control")).toBe("no-store");
    for (const quantity of [0, -1, 1.5]) {
      const response = await app.request(
        "/api/commerce/cart",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "add",
            productId: crypto.randomUUID(),
            quantity,
            operationId: crypto.randomUUID(),
          }),
        },
        env,
      );
      expect(response.status).toBe(400);
    }
    const crossOrigin = await app.request(
      "/api/commerce/cart",
      {
        method: "POST",
        headers: { ...headers, Origin: "https://attacker.example" },
        body: JSON.stringify({ action: "clear", operationId: crypto.randomUUID() }),
      },
      env,
    );
    expect(crossOrigin.status).toBe(403);
  });
});
