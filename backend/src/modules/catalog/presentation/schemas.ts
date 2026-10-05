import { z } from "@hono/zod-openapi";
import { productSorts } from "../domain/model";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const optionSchema = z.object({ slug, name: z.string() });
export const categorySchema = optionSchema
  .extend({ id: z.uuid(), description: z.string(), position: z.number().int() })
  .openapi("Category");
export const brandSchema = optionSchema
  .extend({ id: z.uuid(), description: z.string() })
  .openapi("Brand");
export const productSchema = z
  .object({
    id: z.uuid(),
    slug,
    sku: z.string(),
    name: z.string(),
    description: z.string(),
    shortDescription: z.string(),
    price: z.number().nonnegative().openapi({
      description: "Price in RUB, up to two decimal places. Stored as integer kopecks.",
      example: 2400,
    }),
    currency: z.literal("RUB"),
    category: categorySchema,
    brand: brandSchema,
    color: optionSchema.extend({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
    material: optionSchema,
    type: optionSchema,
    availability: z.enum(["in_stock", "out_of_stock"]),
    featured: z.boolean(),
    createdAt: z.iso.datetime(),
    images: z.array(
      z
        .object({ id: z.uuid(), url: z.url(), alt: z.string(), position: z.number().int() })
        .openapi("ProductImage"),
    ),
    attributes: z.array(
      z
        .object({
          key: slug,
          name: z.string(),
          value: z.string(),
          label: z.string(),
          unit: z.string().nullable(),
        })
        .openapi("ProductAttribute"),
    ),
  })
  .openapi("Product");

export const productPageSchema = z
  .object({
    items: z.array(productSchema),
    pagination: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  })
  .openapi("ProductPage");

const facetOption = optionSchema.extend({ count: z.number().int(), hex: z.string().optional() });
export const facetsSchema = z
  .object({
    categories: z.array(facetOption),
    brands: z.array(facetOption),
    colors: z.array(facetOption),
    materials: z.array(facetOption),
    types: z.array(facetOption),
    attributes: z.array(
      z.object({ key: z.string(), name: z.string(), options: z.array(facetOption) }),
    ),
    price: z.object({ min: z.number(), max: z.number(), currency: z.literal("RUB") }),
  })
  .openapi("CatalogFacets");

export const commaSlugs = z
  .string()
  .max(800)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:,[a-z0-9]+(?:-[a-z0-9]+)*){0,9}$/)
  .openapi({
    description:
      "Comma-separated slugs (maximum 10). OR within this field; AND across different fields.",
    example: "candles,ceramics",
  });
const money = z
  .string()
  .regex(/^\d{1,8}(?:\.\d{1,2})?$/)
  .transform(Number)
  .openapi({
    type: "number",
    minimum: 0,
    maximum: 99999999.99,
    example: 1000,
    description: "Inclusive price in RUB, up to two decimal places.",
  });
export const catalogQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(160)
      .refine((value) => value.split(/\s+/u).length <= 8)
      .optional()
      .openapi({
        description:
          "Case-insensitive literal substring search across name, description, brand, category and attributes. All words must match; maximum 8 words.",
        example: "соевая свеча",
      }),
    category: commaSlugs.optional(),
    brand: commaSlugs.optional(),
    color: commaSlugs.optional(),
    material: commaSlugs.optional(),
    type: commaSlugs.optional(),
    attribute: z
      .string()
      .regex(/^[a-z0-9-]+:[a-z0-9-]+(?:,[a-z0-9-]+:[a-z0-9-]+){0,7}$/)
      .max(500)
      .optional()
      .openapi({
        description:
          "key:value pairs separated by commas. OR for the same key; AND across keys. Discover keys/values with /api/catalog/facets.",
        example: "aroma:woody,aroma:floral,volume:200",
      }),
    priceFrom: money.optional(),
    priceTo: money.optional(),
    availability: z.enum(["in_stock", "out_of_stock"]).optional(),
    featured: z.enum(["true", "false"]).optional(),
    sort: z.enum(productSorts).default("recommended"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict()
  .refine(
    (query) =>
      query.priceFrom === undefined ||
      query.priceTo === undefined ||
      query.priceFrom <= query.priceTo,
    { message: "priceFrom must not exceed priceTo" },
  );

export function splitSlugs(value?: string): string[] {
  return value ? [...new Set(value.split(","))] : [];
}

export function parseAttributeFilter(value?: string) {
  const groups = new Map<string, string[]>();
  for (const pair of value?.split(",") ?? []) {
    const [key, option] = pair.split(":");
    if (key && option) groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return [...groups].map(([key, values]) => ({ key, values: [...new Set(values)] }));
}
