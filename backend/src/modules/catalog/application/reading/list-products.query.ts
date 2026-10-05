import type { CatalogFilter } from "../../domain/model";
import type { CatalogRepository } from "../ports/catalog-repository";

export class ListProductsQuery {
  constructor(private readonly repository: CatalogRepository) {}

  execute(filter: CatalogFilter) {
    return this.repository.list(filter);
  }
}
