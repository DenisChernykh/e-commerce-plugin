import type { CatalogRepository } from "../ports/catalog-repository";

export class GetCatalogMetadataQuery {
  constructor(private readonly repository: CatalogRepository) {}

  categories() {
    return this.repository.categories();
  }

  brands() {
    return this.repository.brands();
  }

  facets(categories: string[]) {
    return this.repository.facets(categories);
  }
}
