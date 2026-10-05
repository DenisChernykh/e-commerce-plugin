import { ProductNotFoundError } from "../../domain/errors";
import type { CatalogRepository } from "../ports/catalog-repository";

export class GetProductQuery {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(identifier: string) {
    const product = await this.repository.findByIdOrSlug(identifier);
    if (!product) throw new ProductNotFoundError();
    return product;
  }

  async related(identifier: string, limit: number) {
    const product = await this.execute(identifier);
    return this.repository.related(product, limit);
  }
}
