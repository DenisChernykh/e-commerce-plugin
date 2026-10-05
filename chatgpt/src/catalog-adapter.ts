import type { z } from "zod";
import { CatalogError, type createBackendClient } from "./backend-client";
import {
  catalogQuerySchema,
  paramsSchema,
  type productInput,
  productPageSchema,
  productSchema,
  type productsInput,
  type Selection,
  type searchInput,
} from "./schemas";

type Api = ReturnType<typeof createBackendClient>;
export function queryString(params: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== null) query.set(key, String(value));
  return query.toString();
}
export function applySearch(input: z.infer<typeof searchInput>) {
  const { base = {}, changes = {} } = input;
  const merged: Record<string, unknown> = { ...base };
  if (Object.keys(changes).some((key) => key !== "page")) merged.page = 1;
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete merged[key];
    else if (value !== undefined) merged[key] = value;
  }
  // Run the exact HTTP validator, including cross-field and search-word constraints.
  const parsed = catalogQuerySchema.safeParse(
    Object.fromEntries(new URLSearchParams(queryString(merged))),
  );
  if (!parsed.success)
    throw new CatalogError(
      parsed.error.issues.map((issue) => issue.message).join("; "),
      "INVALID_PARAMETERS",
      400,
    );
  return paramsSchema.parse(parsed.data);
}
export function positionId(selection: Selection | undefined, position: number) {
  const id = selection?.productIds[position - 1];
  if (!id)
    throw new CatalogError(
      "Этого номера нет в указанной подборке. Уточните подборку или номер.",
      "SELECTION_REQUIRED",
      400,
    );
  return id;
}
const linked = (api: Api, product: z.infer<typeof productSchema>) => ({
  ...product,
  url: new URL(`/products/${encodeURIComponent(product.slug)}`, api.store).href,
});
export async function searchCatalog(api: Api, input: z.infer<typeof searchInput>) {
  const params = applySearch(input);
  const result = await api.request(`/api/products?${queryString(params)}`, productPageSchema);
  const selection = { id: crypto.randomUUID(), params, productIds: result.items.map((p) => p.id) };
  return {
    view: "catalog" as const,
    selection,
    items: result.items.map((product) => {
      const {
        description: _description,
        sku: _sku,
        createdAt: _createdAt,
        ...summary
      } = linked(api, product);
      return summary;
    }),
    pagination: result.pagination,
    returned: result.items.length,
    next:
      result.pagination.page < result.pagination.totalPages
        ? { base: params, changes: { page: params.page + 1 } }
        : null,
    catalogUrl: new URL(`/catalog?${queryString(params)}`, api.store).href,
    fetchedAt: new Date().toISOString(),
    requestId: input.requestId ?? null,
  };
}
export async function readProduct(api: Api, input: z.infer<typeof productInput>) {
  const identifier = input.identifier ?? positionId(input.selection, input.position!);
  return {
    view: "product" as const,
    product: linked(
      api,
      await api.request(`/api/products/${encodeURIComponent(identifier)}`, productSchema),
    ),
    selection: input.selection ?? null,
    fetchedAt: new Date().toISOString(),
    requestId: input.requestId ?? null,
  };
}
export async function readProducts(api: Api, input: z.infer<typeof productsInput>) {
  const ids =
    input.identifiers ?? input.positions!.map((position) => positionId(input.selection, position));
  if (new Set(ids).size !== ids.length)
    throw new CatalogError("Выберите разные товары для сравнения.", "INVALID_PARAMETERS", 400);
  return {
    view: "compare" as const,
    products: await Promise.all(
      ids.map(async (id) => linked(api, await api.request(`/api/products/${id}`, productSchema))),
    ),
    selection: input.selection ?? null,
    fetchedAt: new Date().toISOString(),
    requestId: input.requestId ?? null,
  };
}
