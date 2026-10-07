import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { WorkerHttpEnv } from "../../../platform/http/environment";
import { problem, problemDetailsSchema } from "../../../platform/http/problem-details";
import type { CommerceService } from "../application/commerce-service";
import { type SessionService, secretHash } from "../application/session-service";
import { CommerceError } from "../domain/model";
import {
  attemptSchema,
  cartActionSchema,
  cartSchema,
  createOrderSchema,
  linkSchema,
  orderSchema,
  paySchema,
  prepareSchema,
  quoteSchema,
} from "./schemas";

type Services = { service: CommerceService; sessions: SessionService };
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 500, 503].map((code) => [
    code,
    {
      description: "Request could not be completed",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  ]),
);
const output = <T extends z.ZodType>(schema: T) => ({
  200: { description: "Confirmed server state", content: { "application/json": { schema } } },
  ...errors,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
});
const id = z.object({ id: z.uuid() });
const cookieName = "tiho_session";

export function createCommerceHttp(services: (env: CloudflareBindings) => Services) {
  const router = new OpenAPIHono<WorkerHttpEnv>({
    defaultHook: (result, c) => {
      if (!result.success)
        return problem(
          c,
          400,
          "VALIDATION_FAILED",
          "Проверьте заполненные поля и количество товаров.",
        );
    },
  });
  router.use("/api/commerce/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    if (c.req.method !== "GET" && c.req.method !== "OPTIONS") {
      const origin = c.req.header("Origin");
      if (origin && !c.env.STORE_ORIGINS.split(",").includes(origin))
        return problem(c, 403, "ORIGIN_DENIED", "Откройте действие в магазине TIHO.");
      if (!c.req.header("Content-Type")?.startsWith("application/json"))
        return problem(c, 400, "INVALID_CONTENT_TYPE", "Не удалось прочитать запрос.");
      const bytes = await c.req.arrayBuffer();
      if (bytes.byteLength > 16384)
        return problem(c, 400, "REQUEST_TOO_LARGE", "Слишком большой запрос.");
    }
    await next();
  });
  router.onError((error, c) => {
    if (error instanceof CommerceError) return problem(c, error.status, error.code, error.message);
    throw error;
  });
  async function owner(c: Context<WorkerHttpEnv>) {
    const subject = c.req.header("X-Tiho-Subject");
    if (subject) {
      const credential = c.req.header("Authorization")?.replace(/^Bearer /, "");
      if (!c.env.TIHO_MCP_SECRET || !credential || !/^[a-f0-9]{64}$/.test(subject))
        throw new CommerceError("UNAUTHENTICATED", "Подключение магазина не настроено.", 401);
      const a = await secretHash(credential),
        b = await secretHash(c.env.TIHO_MCP_SECRET);
      let difference = 0;
      for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
      if (difference)
        throw new CommerceError("UNAUTHENTICATED", "Не удалось подтвердить подключение.", 401);
      return `mcp:${subject}`;
    }
    return services(c.env).sessions.owner(getCookie(c, cookieName));
  }
  function cookie(c: Context<WorkerHttpEnv>, token: string) {
    setCookie(c, cookieName, token, {
      httpOnly: true,
      secure: c.env.APP_ENV !== "local",
      sameSite: "Lax",
      path: "/",
      maxAge: 30 * 86400,
    });
  }

  router.openapi(
    createRoute({
      method: "post",
      path: "/api/commerce/session",
      operationId: "startShoppingSession",
      tags: ["Commerce"],
      request: body(z.strictObject({})),
      responses: output(z.object({ ready: z.boolean() })),
    }),
    async (c) => {
      try {
        await owner(c);
      } catch (error) {
        if (!(error instanceof CommerceError && error.code === "SESSION_REQUIRED")) throw error;
        if (c.env.GUEST_ACCESS !== "local" || c.env.APP_ENV !== "local")
          throw new CommerceError(
            "SESSION_REQUIRED",
            "Откройте магазин из TIHO в ChatGPT, чтобы продолжить со своей корзиной.",
            401,
          );
        cookie(c, await services(c.env).sessions.guest());
      }
      return c.json({ ready: true }, 200);
    },
  );
  router.openapi(
    createRoute({
      method: "post",
      path: "/api/commerce/session/exchange",
      operationId: "exchangeShoppingLink",
      tags: ["Commerce"],
      request: body(z.strictObject({ code: z.string().regex(/^[a-f0-9]{64}$/) })),
      responses: output(z.object({ target: z.string() })),
    }),
    async (c) => {
      const result = await services(c.env).sessions.exchange(c.req.valid("json").code);
      cookie(c, result.token);
      return c.json({ target: result.target }, 200);
    },
  );
  router.openapi(
    createRoute({
      method: "post",
      path: "/api/commerce/session/link",
      operationId: "createShoppingLink",
      tags: ["Commerce"],
      request: body(linkSchema),
      responses: output(z.object({ code: z.string(), expiresIn: z.number() })),
    }),
    async (c) =>
      c.json(await services(c.env).sessions.link(await owner(c), c.req.valid("json").target), 200),
  );
  router.openapi(
    createRoute({
      method: "get",
      path: "/api/commerce/cart",
      operationId: "getCart",
      tags: ["Commerce"],
      responses: output(cartSchema),
    }),
    async (c) => c.json(await services(c.env).service.cart(await owner(c)), 200),
  );
  router.openapi(
    createRoute({
      method: "post",
      path: "/api/commerce/cart",
      operationId: "changeCart",
      tags: ["Commerce"],
      request: body(cartActionSchema),
      responses: output(cartSchema),
    }),
    async (c) =>
      c.json(await services(c.env).service.change(await owner(c), c.req.valid("json")), 200),
  );
  router.openapi(
    createRoute({
      method: "post",
      path: "/api/commerce/checkout",
      operationId: "prepareCheckout",
      tags: ["Commerce"],
      request: body(prepareSchema),
      responses: output(quoteSchema),
    }),
    async (c) => {
      const input = c.req.valid("json");
      return c.json(
        await services(c.env).service.prepare(await owner(c), input.cartVersion, input.customer),
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: "post",
      path: "/api/commerce/orders",
      operationId: "createOrder",
      tags: ["Commerce"],
      request: body(createOrderSchema),
      responses: output(orderSchema),
    }),
    async (c) => {
      const input = c.req.valid("json");
      return c.json(
        await services(c.env).service.createOrder(await owner(c), input.quoteId, input.operationId),
        200,
      );
    },
  );
  router.openapi(
    createRoute({
      method: "get",
      path: "/api/commerce/checkout/{id}",
      operationId: "getCheckoutQuote",
      tags: ["Commerce"],
      request: { params: id },
      responses: output(quoteSchema),
    }),
    async (c) =>
      c.json(await services(c.env).service.quote(await owner(c), c.req.valid("param").id), 200),
  );
  router.openapi(
    createRoute({
      method: "get",
      path: "/api/commerce/orders",
      operationId: "listOrders",
      tags: ["Commerce"],
      responses: output(z.object({ items: z.array(orderSchema) })),
    }),
    async (c) => c.json({ items: await services(c.env).service.orders(await owner(c)) }, 200),
  );
  router.openapi(
    createRoute({
      method: "get",
      path: "/api/commerce/orders/{id}",
      operationId: "getOrder",
      tags: ["Commerce"],
      request: { params: id },
      responses: output(orderSchema),
    }),
    async (c) =>
      c.json(await services(c.env).service.order(await owner(c), c.req.valid("param").id), 200),
  );
  router.openapi(
    createRoute({
      method: "post",
      path: "/api/commerce/orders/{id}/payment",
      operationId: "startPayment",
      tags: ["Commerce"],
      request: { params: id, ...body(paySchema) },
      responses: output(attemptSchema),
    }),
    async (c) =>
      c.json(
        await services(c.env).service.pay(
          await owner(c),
          c.req.valid("param").id,
          c.req.valid("json").operationId,
        ),
        200,
      ),
  );
  router.openapi(
    createRoute({
      method: "get",
      path: "/api/commerce/payments/{id}",
      operationId: "getPayment",
      tags: ["Commerce"],
      request: { params: id },
      responses: output(attemptSchema),
    }),
    async (c) =>
      c.json(await services(c.env).service.attempt(await owner(c), c.req.valid("param").id), 200),
  );
  return router;
}
