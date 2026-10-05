import type {
  Brand,
  CatalogFacets,
  CatalogFilter,
  CatalogPage,
  Category,
  Product,
} from "../../domain/model";

export interface CatalogRepository {
  list(filter: CatalogFilter): Promise<CatalogPage>;
  findByIdOrSlug(identifier: string): Promise<Product | null>;
  related(product: Product, limit: number): Promise<Product[]>;
  categories(): Promise<Category[]>;
  brands(): Promise<Brand[]>;
  facets(categories: string[]): Promise<CatalogFacets>;
}
