import { GetCatalogMetadataQuery } from "./application/reading/get-catalog-metadata.query";
import { GetProductQuery } from "./application/reading/get-product.query";
import { ListProductsQuery } from "./application/reading/list-products.query";
import { D1CatalogRepository } from "./infrastructure/d1-catalog-repository";
import { createCatalogHttp } from "./presentation/http";

export function createCatalogModule() {
  return {
    router: createCatalogHttp({
      createQueries(database) {
        const repository = new D1CatalogRepository(database);
        return {
          listProducts: new ListProductsQuery(repository),
          getProduct: new GetProductQuery(repository),
          metadata: new GetCatalogMetadataQuery(repository),
        };
      },
    }),
  };
}
