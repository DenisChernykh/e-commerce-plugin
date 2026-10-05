import { and, asc, count, desc, eq, inArray, ne, or, type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  brands,
  categories,
  productAttributes,
  productImages,
  products,
} from "../../../platform/database/schema";
import type { CatalogRepository } from "../application/ports/catalog-repository";
import type {
  CatalogFacets,
  CatalogFilter,
  CatalogPage,
  FacetOption,
  Product,
  ProductSort,
} from "../domain/model";
import { normalizeSearch } from "../domain/search";

type ProductRow = {
  product: typeof products.$inferSelect;
  category: typeof categories.$inferSelect;
  brand: typeof brands.$inferSelect;
};

function orderBy(sort: ProductSort) {
  const sorting = {
    recommended: [desc(products.featured), desc(products.popularity)],
    price_asc: [asc(products.priceKopecks)],
    price_desc: [desc(products.priceKopecks)],
    newest: [desc(products.createdAt)],
    name_asc: [asc(products.name)],
  };
  return [...sorting[sort], asc(products.id)];
}

function conditions(filter: CatalogFilter) {
  const clauses: SQL[] = [];
  for (const [values, column] of [
    [filter.category, categories.slug],
    [filter.brand, brands.slug],
    [filter.color, products.colorSlug],
    [filter.material, products.materialSlug],
    [filter.type, products.typeSlug],
  ] as const) {
    if (values.length) clauses.push(inArray(column, values));
  }
  if (filter.availability) clauses.push(eq(products.availability, filter.availability));
  if (filter.featured !== undefined) clauses.push(eq(products.featured, filter.featured));
  if (filter.priceFrom !== undefined)
    clauses.push(sql`${products.priceKopecks} >= ${Math.round(filter.priceFrom * 100)}`);
  if (filter.priceTo !== undefined)
    clauses.push(sql`${products.priceKopecks} <= ${Math.round(filter.priceTo * 100)}`);
  for (const term of normalizeSearch(filter.q ?? "")
    .split(" ")
    .filter(Boolean)) {
    const escaped = term.replace(/[\\%_]/gu, "\\$&");
    clauses.push(sql`${products.searchText} LIKE ${`%${escaped}%`} ESCAPE ${"\\"}`);
  }
  for (const attribute of filter.attribute) {
    clauses.push(
      sql`EXISTS (SELECT 1 FROM ${productAttributes} WHERE ${productAttributes.productId} = ${products.id} AND ${productAttributes.key} = ${attribute.key} AND ${inArray(productAttributes.value, attribute.values)})`,
    );
  }
  return and(...clauses);
}

export class D1CatalogRepository implements CatalogRepository {
  private readonly database;

  constructor(binding: D1Database) {
    this.database = drizzle(binding);
  }

  private selection() {
    return this.database
      .select({ product: products, category: categories, brand: brands })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(brands, eq(products.brandId, brands.id));
  }

  private async hydrate(rows: ProductRow[]): Promise<Product[]> {
    if (!rows.length) return [];
    const ids = rows.map(({ product }) => product.id);
    const [images, attributes] = await this.database.batch([
      this.database
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, ids))
        .orderBy(asc(productImages.position)),
      this.database
        .select()
        .from(productAttributes)
        .where(inArray(productAttributes.productId, ids))
        .orderBy(asc(productAttributes.key)),
    ]);
    return rows.map(({ product, category, brand }) => ({
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      price: product.priceKopecks / 100,
      currency: "RUB",
      category,
      brand,
      color: { slug: product.colorSlug, name: product.colorName, hex: product.colorHex },
      material: { slug: product.materialSlug, name: product.materialName },
      type: { slug: product.typeSlug, name: product.typeName },
      availability: product.availability,
      featured: product.featured,
      createdAt: product.createdAt,
      images: images
        .filter((image) => image.productId === product.id)
        .map(({ productId: _productId, ...image }) => image),
      attributes: attributes
        .filter((attribute) => attribute.productId === product.id)
        .map(({ productId: _productId, ...attribute }) => attribute),
    }));
  }

  async list(filter: CatalogFilter): Promise<CatalogPage> {
    const where = conditions(filter);
    const [rows, totals] = await Promise.all([
      this.selection()
        .where(where)
        .orderBy(...orderBy(filter.sort))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.database
        .select({ total: count() })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .innerJoin(brands, eq(products.brandId, brands.id))
        .where(where),
    ]);
    const total = totals[0]?.total ?? 0;
    return {
      items: await this.hydrate(rows),
      pagination: {
        page: filter.page,
        pageSize: filter.pageSize,
        total,
        totalPages: Math.ceil(total / filter.pageSize),
      },
    };
  }

  async findByIdOrSlug(identifier: string) {
    const rows = await this.selection()
      .where(or(eq(products.id, identifier), eq(products.slug, identifier)))
      .limit(1);
    return (await this.hydrate(rows))[0] ?? null;
  }

  async related(product: Product, limit: number) {
    const rows = await this.selection()
      .where(and(eq(products.categoryId, product.category.id), ne(products.id, product.id)))
      .orderBy(desc(products.availability), ...orderBy("recommended"))
      .limit(limit);
    return this.hydrate(rows);
  }

  categories() {
    return this.database.select().from(categories).orderBy(asc(categories.position));
  }

  brands() {
    return this.database.select().from(brands).orderBy(asc(brands.name));
  }

  async facets(categorySlugs: string[]): Promise<CatalogFacets> {
    const scope = categorySlugs.length ? inArray(categories.slug, categorySlugs) : undefined;
    const rows = await this.selection().where(scope);
    const categoryCounts = await this.database
      .select({ slug: categories.slug, name: categories.name, count: count() })
      .from(categories)
      .innerJoin(products, eq(categories.id, products.categoryId))
      .groupBy(categories.id)
      .orderBy(asc(categories.position));
    const attributes = await this.database
      .select({
        key: productAttributes.key,
        name: productAttributes.name,
        value: productAttributes.value,
        label: productAttributes.label,
        count: count(),
      })
      .from(productAttributes)
      .innerJoin(products, eq(productAttributes.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(scope)
      .groupBy(productAttributes.key, productAttributes.value)
      .orderBy(asc(productAttributes.key), asc(productAttributes.value));
    const options = (select: (row: ProductRow) => { slug: string; name: string; hex?: string }) => {
      const result = new Map<string, FacetOption>();
      for (const row of rows) {
        const option = select(row);
        result.set(option.slug, { ...option, count: (result.get(option.slug)?.count ?? 0) + 1 });
      }
      return [...result.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
    };
    const attributeGroups = new Map<string, CatalogFacets["attributes"][number]>();
    for (const attribute of attributes) {
      const group = attributeGroups.get(attribute.key) ?? {
        key: attribute.key,
        name: attribute.name,
        options: [],
      };
      group.options.push({ slug: attribute.value, name: attribute.label, count: attribute.count });
      attributeGroups.set(attribute.key, group);
    }
    const prices = rows.map(({ product }) => product.priceKopecks / 100);
    return {
      categories: categoryCounts,
      brands: options(({ brand }) => ({ slug: brand.slug, name: brand.name })),
      colors: options(({ product }) => ({
        slug: product.colorSlug,
        name: product.colorName,
        hex: product.colorHex,
      })),
      materials: options(({ product }) => ({
        slug: product.materialSlug,
        name: product.materialName,
      })),
      types: options(({ product }) => ({ slug: product.typeSlug, name: product.typeName })),
      attributes: [...attributeGroups.values()],
      price: {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0,
        currency: "RUB",
      },
    };
  }
}
