import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  position: integer("position").notNull(),
});

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    shortDescription: text("short_description").notNull(),
    priceKopecks: integer("price_kopecks").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id),
    colorSlug: text("color_slug").notNull(),
    colorName: text("color_name").notNull(),
    colorHex: text("color_hex").notNull(),
    materialSlug: text("material_slug").notNull(),
    materialName: text("material_name").notNull(),
    typeSlug: text("type_slug").notNull(),
    typeName: text("type_name").notNull(),
    availability: text("availability", { enum: ["in_stock", "out_of_stock"] }).notNull(),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    popularity: integer("popularity").notNull().default(0),
    createdAt: text("created_at").notNull(),
    searchText: text("search_text").notNull(),
  },
  (table) => [
    index("products_category_price_idx").on(table.categoryId, table.priceKopecks),
    index("products_brand_idx").on(table.brandId),
    index("products_price_idx").on(table.priceKopecks),
    check("products_price_nonnegative", sql`${table.priceKopecks} >= 0`),
    check(
      "products_availability_valid",
      sql`${table.availability} IN ('in_stock', 'out_of_stock')`,
    ),
  ],
);

export const productImages = sqliteTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("product_images_product_idx").on(table.productId)],
);

export const productAttributes = sqliteTable(
  "product_attributes",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    value: text("value").notNull(),
    label: text("label").notNull(),
    unit: text("unit"),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.key] }),
    index("product_attributes_filter_idx").on(table.key, table.value),
  ],
);
