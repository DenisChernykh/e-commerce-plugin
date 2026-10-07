import { z } from "@hono/zod-openapi";

export const customerSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(100),
    email: z.email().trim().max(254),
  })
  .openapi("CheckoutCustomer");
export const lineSchema = z
  .object({
    productId: z.uuid(),
    slug: z.string(),
    name: z.string(),
    quantity: z.number().int().min(1).max(99),
    unitPriceMinor: z.number().int().nonnegative(),
    lineTotalMinor: z.number().int().nonnegative(),
    available: z.boolean(),
    image: z.string().nullable(),
    category: z.string(),
    color: z.string(),
    type: z.string(),
  })
  .openapi("CartLine");
export const cartSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().nonnegative(),
    currency: z.literal("RUB"),
    items: z.array(lineSchema),
    totalMinor: z.number().int().nonnegative(),
    itemCount: z.number().int().nonnegative(),
    changes: z.array(z.string()),
  })
  .openapi("Cart");
export const quoteSchema = z
  .object({ id: z.uuid(), cart: cartSchema, customer: customerSchema, expiresAt: z.string() })
  .openapi("CheckoutQuote");
export const attemptSchema = z
  .object({
    id: z.uuid(),
    orderId: z.uuid(),
    status: z.enum(["pending", "processing", "succeeded", "failed"]),
    createdAt: z.string(),
    completedAt: z.string().nullable(),
  })
  .openapi("PaymentAttempt");
export const orderSchema = z
  .object({
    id: z.uuid(),
    number: z.string(),
    createdAt: z.string(),
    customer: customerSchema,
    items: z.array(lineSchema),
    totalMinor: z.number().int().nonnegative(),
    currency: z.literal("RUB"),
    status: z.enum(["placed", "confirmed"]),
    paymentStatus: z.enum(["awaiting_payment", "processing", "completed", "failed"]),
    attempt: attemptSchema.nullable(),
  })
  .openapi("Order");
export const cartActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("add"),
    productId: z.uuid(),
    quantity: z.number().int().min(1).max(99),
    operationId: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("set"),
    productId: z.uuid(),
    quantity: z.number().int().min(1).max(99),
    operationId: z.uuid(),
  }),
  z.strictObject({ action: z.literal("remove"), productId: z.uuid(), operationId: z.uuid() }),
  z.strictObject({ action: z.literal("clear"), operationId: z.uuid() }),
]);
export const prepareSchema = z.strictObject({
  cartVersion: z.number().int().nonnegative(),
  customer: customerSchema,
});
export const createOrderSchema = z.strictObject({ quoteId: z.uuid(), operationId: z.uuid() });
export const paySchema = z.strictObject({ operationId: z.uuid() });
export const linkSchema = z.strictObject({
  target: z.string().regex(/^\/(cart|orders(?:\/[0-9a-f-]{36})?)$/),
});
