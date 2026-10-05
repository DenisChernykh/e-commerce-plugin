import { seedBrands, seedCategories, seedProducts } from "./catalog";

function literal(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
}
function upsert(
  table: string,
  row: Record<string, string | number | boolean | null>,
  conflict = "id",
) {
  const columns = Object.keys(row);
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${Object.values(row).map(literal).join(", ")}) ON CONFLICT (${conflict}) DO UPDATE SET ${columns
    .filter((column) => !conflict.split(", ").includes(column))
    .map((column) => `${column} = excluded.${column}`)
    .join(", ")};`;
}

export function seedStatements(): string[] {
  return [
    ...seedCategories.map((category) => upsert("categories", category)),
    ...seedBrands.map((brand) => upsert("brands", brand)),
    ...seedProducts.flatMap(({ product, searchText, popularity }) => [
      upsert("products", {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        description: product.description,
        short_description: product.shortDescription,
        price_kopecks: Math.round(product.price * 100),
        category_id: product.category.id,
        brand_id: product.brand.id,
        color_slug: product.color.slug,
        color_name: product.color.name,
        color_hex: product.color.hex,
        material_slug: product.material.slug,
        material_name: product.material.name,
        type_slug: product.type.slug,
        type_name: product.type.name,
        availability: product.availability,
        featured: product.featured,
        created_at: product.createdAt,
        popularity,
        search_text: searchText,
      }),
      ...product.attributes.map((entry) =>
        upsert("product_attributes", { product_id: product.id, ...entry }, "product_id, key"),
      ),
    ]),
  ];
}
