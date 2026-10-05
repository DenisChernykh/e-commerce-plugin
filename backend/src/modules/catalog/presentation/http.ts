import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { WorkerHttpEnv } from "../../../platform/http/environment";
import { problem, problemDetailsSchema } from "../../../platform/http/problem-details";
import type { GetCatalogMetadataQuery } from "../application/reading/get-catalog-metadata.query";
import type { GetProductQuery } from "../application/reading/get-product.query";
import type { ListProductsQuery } from "../application/reading/list-products.query";
import { ProductNotFoundError } from "../domain/errors";
import {
  brandSchema,
  catalogQuerySchema,
  categorySchema,
  commaSlugs,
  facetsSchema,
  parseAttributeFilter,
  productPageSchema,
  productSchema,
  splitSlugs,
} from "./schemas";

type Dependencies = {
  createQueries(database: D1Database): {
    listProducts: ListProductsQuery;
    getProduct: GetProductQuery;
    metadata: GetCatalogMetadataQuery;
  };
};
const errors = {
  400: {
    description: "Invalid query/path. Unknown query fields and malformed filters are rejected.",
    content: { "application/problem+json": { schema: problemDetailsSchema } },
  },
  404: {
    description: "Resource does not exist.",
    content: { "application/problem+json": { schema: problemDetailsSchema } },
  },
  500: {
    description: "Unexpected server error.",
    content: { "application/problem+json": { schema: problemDetailsSchema } },
  },
};
const productParameter = z.object({
  identifier: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .openapi({
      description: "Stable product UUID or human-readable slug.",
      example: "candle-quiet-morning",
    }),
});

export function createCatalogHttp(dependencies: Dependencies) {
  const router = new OpenAPIHono<WorkerHttpEnv>({
    defaultHook: (result, context) => {
      if (!result.success)
        return problem(
          context,
          400,
          "VALIDATION_FAILED",
          "The request does not match the API contract.",
        );
    },
  });
  router.onError((error, context) => {
    if (error instanceof ProductNotFoundError)
      return problem(context, 404, "PRODUCT_NOT_FOUND", "The requested product does not exist.");
    throw error;
  });

  router.openapi(
    createRoute({
      method: "get",
      path: "/api/products",
      operationId: "listProducts",
      tags: ["Catalog"],
      summary: "Search, filter and paginate the catalog",
      description:
        "Public read-only catalog. Multiple values within a filter are OR; different filters are AND. Price bounds are inclusive RUB. Sorting always includes a stable ID tie-breaker. Pages beyond the last return an empty items array with the correct total.",
      request: { query: catalogQuerySchema },
      responses: {
        200: {
          description: "Matching products and pagination metadata",
          content: { "application/json": { schema: productPageSchema } },
        },
        ...errors,
      },
    }),
    async (context) => {
      const query = context.req.valid("query");
      const result = await dependencies.createQueries(context.env.DB).listProducts.execute({
        ...query,
        category: splitSlugs(query.category),
        brand: splitSlugs(query.brand),
        color: splitSlugs(query.color),
        material: splitSlugs(query.material),
        type: splitSlugs(query.type),
        attribute: parseAttributeFilter(query.attribute),
        featured: query.featured === undefined ? undefined : query.featured === "true",
      });
      return context.json(result, 200);
    },
  );

  router.openapi(
    createRoute({
      method: "get",
      path: "/api/products/{identifier}",
      operationId: "getProduct",
      tags: ["Catalog"],
      summary: "Get a product by UUID or slug",
      request: { params: productParameter },
      responses: {
        200: {
          description: "Full structured product",
          content: { "application/json": { schema: productSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        await dependencies
          .createQueries(context.env.DB)
          .getProduct.execute(context.req.valid("param").identifier),
        200,
      ),
  );

  router.openapi(
    createRoute({
      method: "get",
      path: "/api/products/{identifier}/related",
      operationId: "getRelatedProducts",
      tags: ["Catalog"],
      summary: "Products from the same category, excluding the current product",
      request: {
        params: productParameter,
        query: z.object({ limit: z.coerce.number().int().min(1).max(12).default(4) }).strict(),
      },
      responses: {
        200: {
          description: "Available products first, then editorial ranking",
          content: { "application/json": { schema: z.object({ items: z.array(productSchema) }) } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        {
          items: await dependencies
            .createQueries(context.env.DB)
            .getProduct.related(
              context.req.valid("param").identifier,
              context.req.valid("query").limit,
            ),
        },
        200,
      ),
  );

  router.openapi(
    createRoute({
      method: "get",
      path: "/api/categories",
      operationId: "listCategories",
      tags: ["Metadata"],
      summary: "All categories in display order",
      responses: {
        200: {
          description: "Catalog categories",
          content: { "application/json": { schema: z.object({ items: z.array(categorySchema) }) } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        { items: await dependencies.createQueries(context.env.DB).metadata.categories() },
        200,
      ),
  );

  router.openapi(
    createRoute({
      method: "get",
      path: "/api/brands",
      operationId: "listBrands",
      tags: ["Metadata"],
      summary: "All product brands",
      responses: {
        200: {
          description: "Catalog brands",
          content: { "application/json": { schema: z.object({ items: z.array(brandSchema) }) } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        { items: await dependencies.createQueries(context.env.DB).metadata.brands() },
        200,
      ),
  );

  router.openapi(
    createRoute({
      method: "get",
      path: "/api/catalog/facets",
      operationId: "getCatalogFacets",
      tags: ["Metadata"],
      summary: "Discover filter values, labels, counts and price range",
      description:
        "Facet counts and price range are scoped ONLY to the optional categories. They do not change with search/other filters. Category counts always cover the whole catalog. This keeps choices available when combining filters.",
      request: { query: z.object({ category: commaSlugs.optional() }).strict() },
      responses: {
        200: {
          description: "Available facets with machine values and display labels",
          content: { "application/json": { schema: facetsSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        await dependencies
          .createQueries(context.env.DB)
          .metadata.facets(splitSlugs(context.req.valid("query").category)),
        200,
      ),
  );

  return router;
}
