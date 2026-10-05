export type Option = { slug: string; name: string };
export type Category = Option & { id: string; description: string; position: number };
export type Brand = Option & { id: string; description: string };
export type ProductImage = { id: string; url: string; alt: string; position: number };
export type ProductAttribute = {
  key: string;
  name: string;
  value: string;
  label: string;
  unit: string | null;
};
export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  currency: "RUB";
  category: Category;
  brand: Brand;
  color: Option & { hex: string };
  material: Option;
  type: Option;
  availability: "in_stock" | "out_of_stock";
  featured: boolean;
  createdAt: string;
  images: ProductImage[];
  attributes: ProductAttribute[];
};
export const productSorts = [
  "recommended",
  "price_asc",
  "price_desc",
  "newest",
  "name_asc",
] as const;
export type ProductSort = (typeof productSorts)[number];
export type CatalogFilter = {
  q?: string;
  category: string[];
  brand: string[];
  color: string[];
  material: string[];
  type: string[];
  attribute: { key: string; values: string[] }[];
  availability?: Product["availability"];
  priceFrom?: number;
  priceTo?: number;
  featured?: boolean;
  sort: ProductSort;
  page: number;
  pageSize: number;
};
export type CatalogPage = {
  items: Product[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type FacetOption = Option & { count: number; hex?: string };
export type CatalogFacets = {
  categories: FacetOption[];
  brands: FacetOption[];
  colors: FacetOption[];
  materials: FacetOption[];
  types: FacetOption[];
  attributes: { key: string; name: string; options: FacetOption[] }[];
  price: { min: number; max: number; currency: "RUB" };
};
