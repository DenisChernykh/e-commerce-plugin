import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  attemptSchema,
  cartSchema,
  createOrderSchema,
  orderSchema,
  prepareSchema,
  quoteSchema,
} from "@tiho/backend/commerce-contracts";
import { z } from "zod";
import {
  type BackendFetch,
  CatalogError,
  createBackendClient,
  type Environment,
} from "./backend-client";
import { readProduct } from "./catalog-adapter";
import { productInput } from "./schemas";

export const commerceViewSchema = z
  .strictObject({
    view: z.enum(["cart", "checkout", "payment", "order", "orders"]),
    orderId: z.uuid().optional(),
    quoteId: z.uuid().optional(),
  })
  .refine((i) => !["payment", "order"].includes(i.view) || !!i.orderId, {
    message: "Для оплаты и заказа нужен orderId.",
  });
const shoppingOutput = z.object({
  view: z.literal("shopping"),
  screen: z.enum(["cart", "checkout", "payment", "order", "orders"]),
  cart: cartSchema,
  order: orderSchema.optional(),
  quote: quoteSchema.optional(),
});
export const updateCartSchema = z
  .strictObject({
    action: z.enum(["add", "set", "remove", "clear"]),
    productId: z.uuid().optional(),
    product: productInput.optional(),
    quantity: z.number().int().min(1).max(99).optional(),
    operationId: z
      .uuid()
      .describe(
        "Один UUID на намерение. Сетевой повтор — тот же UUID; новое осознанное действие — новый UUID.",
      ),
  })
  .refine(
    (i) =>
      i.action === "clear"
        ? !i.productId && !i.product && i.quantity === undefined
        : Boolean(i.productId) !== Boolean(i.product),
    { message: "Нужен один конкретный товар; очистка не принимает товар." },
  )
  .refine(
    (i) =>
      ["add", "set"].includes(i.action) ? i.quantity !== undefined : i.quantity === undefined,
    { message: "Количество нужно только при добавлении или изменении." },
  );

export async function commerceClient(
  request: Request,
  env: Environment,
  fetchBackend: BackendFetch,
) {
  const local =
    env.MCP_AUTH_MODE === "local" &&
    ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
  // Sites ingress authenticates and overwrites this header. Never deploy this
  // mode on a public Worker route; local identity is explicit and loopback-only.
  const visitor = local
    ? env.DEV_MCP_USER
    : env.MCP_AUTH_MODE === "sites"
      ? request.headers.get("oai-authenticated-user-id")
      : null;
  if (!visitor || !env.TIHO_MCP_SECRET || env.TIHO_MCP_SECRET.length < 32)
    throw new CatalogError(
      "Подключите TIHO в ChatGPT, чтобы открыть свою корзину.",
      "SESSION_REQUIRED",
      401,
    );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.TIHO_MCP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`tiho-shopping:${visitor}`),
  );
  const subject = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return createBackendClient(env, fetchBackend, {
    Authorization: `Bearer ${env.TIHO_MCP_SECRET}`,
    "X-Tiho-Subject": subject,
  });
}

export function registerCommerceTools(
  server: McpServer,
  request: Request,
  env: Environment,
  fetchBackend: BackendFetch,
  uiUri: string,
) {
  const read = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const write = { ...read, readOnlyHint: false };
  const visible = { ui: { visibility: ["model", "app"] } };
  const ui = { ui: { resourceUri: uiUri, visibility: ["model", "app"] } };
  async function run(
    operation: (api: Awaited<ReturnType<typeof commerceClient>>) => Promise<unknown>,
  ): Promise<CallToolResult> {
    try {
      const data = await operation(await commerceClient(request, env, fetchBackend));
      return {
        content: [{ type: "text", text: JSON.stringify({ data }) }],
        structuredContent: { data },
      };
    } catch (error) {
      const failure =
        error instanceof CatalogError
          ? error
          : new CatalogError(
              "Ответ магазина не получен. Перед повтором проверьте состояние операции.",
            );
      return {
        isError: true,
        content: [{ type: "text", text: failure.message }],
        structuredContent: {
          error: { code: failure.code, message: failure.message, status: failure.status },
        },
      };
    }
  }
  server.registerTool(
    "get_cart",
    {
      title: "Корзина TIHO",
      description:
        "Прочитать сохранённую корзину и серверный итог. Достаточно для текстового ответа о сумме; UI не открывает. При сетевой неопределённости сначала прочитай состояние, затем повторяй прежний operationId.",
      inputSchema: z.strictObject({}),
      outputSchema: z.object({ data: cartSchema }),
      annotations: read,
      _meta: visible,
    },
    () => run((api) => api.request("/api/commerce/cart", cartSchema)),
  );
  server.registerTool(
    "update_cart",
    {
      title: "Изменить корзину",
      description:
        "Добавить, задать количество, удалить товар или очистить корзину. Добавление повторно отдельным действием увеличивает количество. Второй вариант — product.position + актуальная product.selection. Не оформляет заказ. Цены и владелец определяются backend. Возвращает подтверждённую корзину.",
      inputSchema: updateCartSchema,
      outputSchema: z.object({ data: cartSchema }),
      annotations: { ...write, destructiveHint: true },
      _meta: visible,
    },
    (input) =>
      run(async (api) => {
        const productId = input.product
          ? (await readProduct(api, input.product)).product.id
          : input.productId;
        return api.request(
          "/api/commerce/cart",
          cartSchema,
          {
            action: input.action,
            ...(productId ? { productId } : {}),
            ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
            operationId: input.operationId,
          },
          "POST",
        );
      }),
  );
  server.registerTool(
    "prepare_checkout",
    {
      title: "Проверка заказа",
      description:
        "Подготовить сохраняемую сводку из актуальной версии корзины и имени/email. Покажи позиции, количества, цены, итог, валюту и контакты до подтверждения. При CART_CHANGED перечитай корзину. Этот tool не создаёт заказ и не запускает оплату.",
      inputSchema: prepareSchema,
      outputSchema: z.object({ data: quoteSchema }),
      annotations: { ...write, idempotentHint: false },
      _meta: visible,
    },
    (input) => run((api) => api.request("/api/commerce/checkout", quoteSchema, input, "POST")),
  );
  server.registerTool(
    "create_order",
    {
      title: "Оформить заказ",
      description:
        "Только по явному намерению оформить уже показанную актуальную сводку quoteId. Не требуй повторного согласия, если оно уже дано после сводки. Недостающие контакты запрашиваются до prepare_checkout. Добавление или просмотр не разрешают оформление. Сетевой повтор использует прежние quoteId и operationId и возвращает тот же заказ. Оплата отдельно.",
      inputSchema: createOrderSchema,
      outputSchema: z.object({ data: orderSchema }),
      annotations: write,
      _meta: visible,
    },
    (input) => run((api) => api.request("/api/commerce/orders", orderSchema, input, "POST")),
  );
  server.registerTool(
    "get_order",
    {
      title: "Посмотреть заказ",
      description:
        "Сохранённый заказ текущего пользователя. Проверить результат предыдущего оформления/оплаты. Не объявляй успех до подтверждённого backend результата; заказ сохраняется и при неуспешной оплате.",
      inputSchema: z.strictObject({ orderId: z.uuid() }),
      outputSchema: z.object({ data: orderSchema }),
      annotations: read,
      _meta: visible,
    },
    (input) => run((api) => api.request(`/api/commerce/orders/${input.orderId}`, orderSchema)),
  );
  server.registerTool(
    "list_orders",
    {
      title: "Заказы TIHO",
      description:
        "Последние сохранённые заказы текущего пользователя. Используй для восстановления после потерянного ответа оформления; не придумывай номер заказа.",
      inputSchema: z.strictObject({}),
      outputSchema: z.object({ data: z.object({ items: z.array(orderSchema) }) }),
      annotations: read,
      _meta: visible,
    },
    () =>
      run((api) => api.request("/api/commerce/orders", z.object({ items: z.array(orderSchema) }))),
  );
  server.registerTool(
    "start_payment",
    {
      title: "Оплатить заказ",
      description:
        "Отдельное явное действие пользователя «Оплатить». Передай сохранённый orderId и UUID намерения. При тайм-ауте сначала get_order/get_payment; затем тот же operationId. После подтверждённой ошибки новая попытка с новым UUID в том же заказе. В этом окружении работает внутренний адаптер без банка и списаний. Не утверждай поступление реальных денег.",
      inputSchema: z.strictObject({ orderId: z.uuid(), operationId: z.uuid() }),
      outputSchema: z.object({ data: attemptSchema }),
      annotations: write,
      _meta: visible,
    },
    (input) =>
      run((api) =>
        api.request(
          `/api/commerce/orders/${input.orderId}/payment`,
          attemptSchema,
          { operationId: input.operationId },
          "POST",
        ),
      ),
  );
  server.registerTool(
    "get_payment",
    {
      title: "Состояние оплаты",
      description:
        "Состояние уже начатой попытки. pending/processing требуют повторной проверки, succeeded подтверждает лишь внутренний цикл. Пользователю сообщай сохранённый номер, состав и итог заказа, без утверждений о списании, письме, резерве и доставке.",
      inputSchema: z.strictObject({ attemptId: z.uuid() }),
      outputSchema: z.object({ data: attemptSchema }),
      annotations: read,
      _meta: visible,
    },
    (input) =>
      run((api) => api.request(`/api/commerce/payments/${input.attemptId}`, attemptSchema)),
  );
  server.registerTool(
    "open_checkout",
    {
      title: "TIHO — покупки",
      description:
        "Открыть панель корзины, оформления, оплаты или сохранённого заказа. Открытие панели само не оформляет и не оплачивает. Для простого вопроса о сумме достаточно get_cart. Это новый визуальный результат; существующая панель сверяет данные через backend.",
      inputSchema: commerceViewSchema,
      outputSchema: z.object({ data: shoppingOutput }),
      annotations: read,
      _meta: ui,
    },
    (input) =>
      run(async (api) => ({
        view: "shopping",
        screen: input.view,
        cart: await api.request("/api/commerce/cart", cartSchema),
        ...(input.orderId
          ? { order: await api.request(`/api/commerce/orders/${input.orderId}`, orderSchema) }
          : {}),
        ...(input.quoteId
          ? { quote: await api.request(`/api/commerce/checkout/${input.quoteId}`, quoteSchema) }
          : {}),
      })),
  );
  server.registerTool(
    "store_link",
    {
      title: "Открыть магазин",
      description:
        "Одноразовая привязка сайта к текущей корзине. Только для UI; ссылка возвращается в _meta и не попадает в текст модели.",
      inputSchema: z.strictObject({
        target: z.string().regex(/^\/(cart|orders(?:\/[0-9a-f-]{36})?)$/),
      }),
      outputSchema: z.object({ ready: z.boolean() }),
      annotations: { ...write, idempotentHint: false },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      try {
        const api = await commerceClient(request, env, fetchBackend);
        const link = await api.request(
          "/api/commerce/session/link",
          z.object({ code: z.string(), expiresIn: z.number() }),
          input,
          "POST",
        );
        return {
          content: [{ type: "text", text: "Переход в магазин готов." }],
          structuredContent: { ready: true },
          _meta: { storeLink: `${api.store.origin}/connect#code=${link.code}` },
        };
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: "Не удалось открыть магазин. Повторите переход." }],
        };
      }
    },
  );
}
