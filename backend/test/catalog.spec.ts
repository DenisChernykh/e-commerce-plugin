import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { seedStatements } from "../seed/sql";
import { createApp } from "../src/app/create-app";
import type { CatalogFacets, Product } from "../src/modules/catalog/domain/model";
import { productPageSchema } from "../src/modules/catalog/presentation/schemas";

const app = createApp();
const request = (path: string) => app.request(`http://catalog.test${path}`, undefined, env);
async function catalog(query = "") {
  const response = await request(`/api/products${query}`);
  expect(response.status).toBe(200);
  return productPageSchema.parse(await response.json());
}

describe("catalog API with real D1 migrations and seed", () => {
  it("provides 72 stable products, real totals and non-overlapping pages", async () => {
    const first = await catalog();
    const second = await catalog("?page=2");
    expect(first.pagination).toEqual({ page: 1, pageSize: 12, total: 72, totalPages: 6 });
    expect(first.items).toHaveLength(12);
    expect(
      second.items.some((product) => first.items.some((other) => other.id === product.id)),
    ).toBe(false);
    expect((await catalog("?page=999")).items).toEqual([]);
  });

  it("finds mixed-case Russian across names, descriptions and attributes", async () => {
    for (const query of ["ТИХОЕ УТРО", "кедр", "хлопковый", "Quiet Form", "керамика", "350 мл"]) {
      expect((await catalog(`?q=${encodeURIComponent(query)}`)).pagination.total).toBeGreaterThan(
        0,
      );
    }
    const result = await catalog(`?q=${encodeURIComponent("СОЕВЫЙ СВЕЧА")}`);
    expect(result.items.every((product) => product.material.slug === "soy")).toBe(true);
    expect(result.pagination.total).toBeGreaterThan(0);
    expect((await catalog(`?q=${encodeURIComponent("тёплый")}`)).pagination.total).toBe(
      (await catalog(`?q=${encodeURIComponent("теплый")}`)).pagination.total,
    );
  });

  it("treats SQL wildcards and injection as literal search text", async () => {
    for (const query of ["%", "_", "' OR 1=1 --"])
      expect((await catalog(`?q=${encodeURIComponent(query)}`)).pagination.total).toBe(0);
  });

  it("combines OR within dimensions and AND between dimensions, including attributes", async () => {
    const result = await catalog(
      "?category=candles,diffusers&color=beige,green&priceFrom=2000&priceTo=3500&availability=in_stock&attribute=aroma:woody,aroma:fresh&sort=price_asc",
    );
    expect(result.pagination.total).toBeGreaterThan(1);
    for (const product of result.items) {
      expect(["candles", "diffusers"]).toContain(product.category.slug);
      expect(["beige", "green"]).toContain(product.color.slug);
      expect(product.price).toBeGreaterThanOrEqual(2000);
      expect(product.price).toBeLessThanOrEqual(3500);
      expect(product.availability).toBe("in_stock");
      expect(
        product.attributes.some(
          (entry) => entry.key === "aroma" && ["woody", "fresh"].includes(entry.value),
        ),
      ).toBe(true);
    }
    const attributeResult = await catalog("?category=candles&attribute=aroma:woody,burn-time:40");
    expect(attributeResult.items.some((product) => product.slug === "candle-quiet-morning")).toBe(
      true,
    );
    expect(
      attributeResult.items.every((product) =>
        product.attributes.some((entry) => entry.key === "burn-time" && entry.value === "40"),
      ),
    ).toBe(true);
  });

  it("supports brand, type, material, availability and inclusive decimal prices", async () => {
    const result = await catalog(
      "?brand=quiet-form&type=jar-candle&material=soy&priceFrom=2399.99&priceTo=2400&availability=in_stock",
    );
    expect(result.items.map((product) => product.slug)).toEqual(["candle-quiet-morning"]);
    expect((await catalog("?availability=out_of_stock")).pagination.total).toBe(12);
    expect((await catalog("?featured=true")).pagination.total).toBe(12);
    expect((await catalog("?category=unknown")).pagination.total).toBe(0);
  });

  it("sorts deterministically in both price directions and by date", async () => {
    for (const sort of ["price_asc", "price_desc"]) {
      const result = await catalog(`?sort=${sort}&pageSize=48`);
      const prices = result.items.map((product) => product.price);
      expect(prices).toEqual(
        [...prices].sort((left, right) => (sort === "price_asc" ? left - right : right - left)),
      );
    }
    const result = await catalog("?sort=newest");
    const dates = result.items.map((product) => product.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it.each([
    "priceFrom=5000&priceTo=1000",
    "page=0",
    "pageSize=500",
    "sort=invalid",
    "priceFrom=",
    "priceTo=NaN",
    "availability=maybe",
    "attribute=aroma",
    "unknown=true",
  ])("rejects malformed query %s with Problem Details", async (query) => {
    const response = await request(`/api/products?${query}`);
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({
      code: "VALIDATION_FAILED",
      status: 400,
      requestId: expect.any(String),
    });
  });

  it("resolves the same product by ID and slug and excludes it from related results", async () => {
    const product = (await (await request("/api/products/candle-quiet-morning")).json()) as Product;
    expect(await (await request(`/api/products/${product.id}`)).json()).toEqual(product);
    const related = (await (await request(`/api/products/${product.id}/related`)).json()) as {
      items: Product[];
    };
    expect(related.items).toHaveLength(4);
    expect(
      related.items.every(
        (entry) => entry.id !== product.id && entry.category.id === product.category.id,
      ),
    ).toBe(true);
    expect((await request("/api/products/missing")).status).toBe(404);
    expect((await request("/api/products/missing/related")).status).toBe(404);
  });

  it("returns category-scoped facets and complete metadata", async () => {
    const result = (await (
      await request("/api/catalog/facets?category=candles")
    ).json()) as CatalogFacets;
    expect(result.categories).toHaveLength(6);
    expect(result.categories.reduce((total, category) => total + category.count, 0)).toBe(72);
    expect(result.materials.map((material) => material.slug).sort()).toEqual([
      "beeswax",
      "coconut",
      "soy",
    ]);
    expect(result.attributes.some((attribute) => attribute.key === "burn-time")).toBe(true);
    expect(result.price).toEqual({ min: 950, max: 4200, currency: "RUB" });
    expect(await (await request("/api/categories")).json()).toMatchObject({
      items: expect.any(Array),
    });
    expect(await (await request("/api/brands")).json()).toMatchObject({ items: expect.any(Array) });
  });

  it("publishes stable OpenAPI operations and read-only CORS", async () => {
    const response = await request("/openapi.json");
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, { get: { operationId: string } }>;
    };
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/api/products"]?.get.operationId).toBe("listProducts");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(
      (await app.request("http://catalog.test/api/products", { method: "POST" }, env)).status,
    ).toBe(404);
  });

  it("re-running seed preserves IDs, count and separately supplied images", async () => {
    const product = (await catalog()).items[0];
    if (!product) throw new Error("Seed must contain products");
    const imageId = "7469686f-0000-4000-8000-999999999999";
    await env.DB.prepare(
      "INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(imageId, product.id, "https://example.com/product.jpg", "Снимок товара", 0)
      .run();
    const before = await catalog();
    const statements = seedStatements();
    for (let offset = 0; offset < statements.length; offset += 40)
      await env.DB.batch(
        statements.slice(offset, offset + 40).map((statement) => env.DB.prepare(statement)),
      );
    expect(await catalog()).toEqual(before);
    const savedProduct = (await (await request(`/api/products/${product.id}`)).json()) as Product;
    expect(savedProduct.images).toHaveLength(1);
    expect(savedProduct.images[0]?.id).toBe(imageId);
    await env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(imageId).run();
  });
});
