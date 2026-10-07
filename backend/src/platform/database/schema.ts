import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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

export const commerceCarts = sqliteTable("commerce_carts", {
  owner: text("owner").primaryKey(),
  id: text("id").notNull().unique(),
  version: integer("version").notNull(),
  snapshot: text("snapshot").notNull(),
});
export const commerceSessions = sqliteTable("commerce_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  owner: text("owner").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const commerceLinks = sqliteTable("commerce_links", {
  codeHash: text("code_hash").primaryKey(),
  owner: text("owner").notNull(),
  target: text("target").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const commerceQuotes = sqliteTable("commerce_quotes", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  cartVersion: integer("cart_version").notNull(),
  snapshot: text("snapshot").notNull(),
  expiresAt: text("expires_at").notNull(),
});
export const commerceOperations = sqliteTable(
  "commerce_operations",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    snapshot: text("snapshot").notNull(),
    applied: integer("applied").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.id] }),
    check("commerce_cas_applied", sql`${t.applied} = 1`),
  ],
);
export const commerceOrders = sqliteTable(
  "commerce_orders",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    owner: text("owner").notNull(),
    cartVersion: integer("cart_version").notNull(),
    quoteId: text("quote_id").notNull().unique(),
    operationId: text("operation_id").notNull(),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull(),
    paymentMode: text("payment_mode").notNull(),
    paymentStatus: text("payment_status").notNull(),
    valid: integer("valid").notNull(),
  },
  (t) => [
    uniqueIndex("commerce_order_version").on(t.owner, t.cartVersion),
    uniqueIndex("commerce_order_intent").on(t.owner, t.operationId),
    index("commerce_order_owner").on(t.owner, t.createdAt),
    check("commerce_order_valid", sql`${t.valid} = 1`),
    check("commerce_payment_mode", sql`${t.paymentMode} = 'internal_presentation'`),
  ],
);
export const commerceAttempts = sqliteTable(
  "commerce_attempts",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    orderId: text("order_id")
      .notNull()
      .references(() => commerceOrders.id),
    operationId: text("operation_id").notNull(),
    status: text("status").notNull(),
    outcome: text("outcome").notNull(),
    createdAt: text("created_at").notNull(),
    readyAt: integer("ready_at").notNull(),
    completedAt: text("completed_at"),
  },
  (t) => [
    uniqueIndex("commerce_payment_intent").on(t.owner, t.operationId),
    uniqueIndex("commerce_payment_active").on(t.orderId).where(sql`${t.status} != 'failed'`),
    index("commerce_payment_order").on(t.orderId, t.createdAt),
    check(
      "commerce_attempt_status",
      sql`${t.status} IN ('pending', 'processing', 'internal_succeeded', 'failed')`,
    ),
    check("commerce_attempt_outcome", sql`${t.outcome} IN ('internal_succeeded', 'failed')`),
  ],
);
