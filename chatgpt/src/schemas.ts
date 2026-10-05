import {
  catalogQuerySchema,
  facetsSchema,
  productPageSchema,
  productSchema,
} from "@tiho/backend/catalog-contracts";
import { z } from "zod";

export { catalogQuerySchema, facetsSchema, productPageSchema, productSchema };

const money = z.number().min(0).max(99999999.99).multipleOf(0.01);
// The HTTP contract owns all catalog constraints; only money changes transport type.
export const paramsSchema = z.strictObject({
  ...catalogQuerySchema.shape,
  priceFrom: money.optional(),
  priceTo: money.optional(),
});
const changeFields = {
  ...paramsSchema.shape,
  sort: paramsSchema.shape.sort.removeDefault(),
  page: paramsSchema.shape.page.removeDefault(),
  pageSize: paramsSchema.shape.pageSize.removeDefault(),
};
export const changesSchema = z.strictObject(
  Object.fromEntries(
    Object.entries(changeFields).map(([key, schema]) => [key, schema.nullable().optional()]),
  ) as {
    [K in keyof typeof changeFields]: z.ZodOptional<z.ZodNullable<(typeof changeFields)[K]>>;
  },
);
export const searchInput = z.strictObject({
  base: paramsSchema
    .optional()
    .describe("selection.params предыдущей подборки. Сохраняет все её ограничения."),
  changes: changesSchema
    .optional()
    .describe(
      "Только изменяемые поля. null снимает поле. Любое изменение кроме page возвращает на страницу 1.",
    ),
  requestId: z
    .uuid()
    .optional()
    .describe("UI correlation ID; повторяет идентификатор запроса в ответе."),
});
export const selectionSchema = z.strictObject({
  id: z.uuid(),
  params: paramsSchema,
  productIds: z.array(z.uuid()).max(48),
});
export const productInput = z
  .strictObject({
    identifier: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    selection: selectionSchema.optional(),
    position: z.number().int().min(1).max(48).optional(),
    requestId: z.uuid().optional(),
  })
  .refine((input) => Boolean(input.identifier) !== (input.position !== undefined), {
    message: "Передайте identifier ИЛИ position с selection, но не оба.",
  })
  .refine((input) => input.position === undefined || Boolean(input.selection), {
    message: "Для номера товара нужна конкретная selection из показанной подборки.",
  });
export const productsInput = z
  .strictObject({
    identifiers: z.array(z.uuid()).min(2).max(4).optional(),
    selection: selectionSchema.optional(),
    positions: z.array(z.number().int().min(1).max(48)).min(2).max(4).optional(),
    requestId: z.uuid().optional(),
  })
  .refine((input) => Boolean(input.identifiers) !== Boolean(input.positions), {
    message: "Передайте identifiers ИЛИ positions с selection.",
  })
  .refine((input) => !input.positions || Boolean(input.selection), {
    message: "Для номеров товаров нужна конкретная selection.",
  });
export const openInput = z
  .strictObject({
    search: searchInput.optional(),
    product: productInput.optional(),
    comparison: productsInput.optional(),
    previousSelections: z
      .array(selectionSchema)
      .max(8)
      .optional()
      .describe(
        "История UI. При изменении фильтров/страницы добавь текущую selection к previousSelections (последние 8). Для деталей/сравнения передай историю без добавления. Для возврата извлеки последнюю selection в search.base и передай оставшуюся историю.",
      ),
  })
  .refine((input) => [input.search, input.product, input.comparison].filter(Boolean).length <= 1, {
    message: "Выберите один режим: search, product или comparison.",
  });
const linkedProduct = productSchema.extend({ url: z.url() });
// Compact search results retain real attributes but omit long descriptions.
export const summarySchema = linkedProduct.omit({ description: true, sku: true, createdAt: true });
const responseBase = {
  fetchedAt: z.iso.datetime(),
  requestId: z.uuid().nullable(),
  selection: selectionSchema.nullable(),
  previousSelections: z.array(selectionSchema).max(8).optional(),
};
export const searchOutput = z.object({
  ...responseBase,
  view: z.literal("catalog"),
  selection: selectionSchema,
  items: z.array(summarySchema),
  pagination: productPageSchema.shape.pagination,
  returned: z.number().int(),
  next: searchInput.nullable(),
  catalogUrl: z.url(),
});
export const productOutput = z.object({
  ...responseBase,
  view: z.literal("product"),
  product: linkedProduct,
});
export const productsOutput = z.object({
  ...responseBase,
  view: z.literal("compare"),
  products: z.array(linkedProduct),
});
export const openOutput = z.object({
  data: z.union([searchOutput, productOutput, productsOutput]),
});
export type Params = z.infer<typeof paramsSchema>;
export type Selection = z.infer<typeof selectionSchema>;
