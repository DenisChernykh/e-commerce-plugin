export {
  ApiNetworkError,
  ApiProblemError,
  ApiProtocolError,
} from './client/api-errors'
export {
  listProducts,
  getProduct,
  getRelatedProducts,
  getListProductsQueryOptions,
} from './generated/catalog/catalog'
export {
  listCategories,
  getGetCatalogFacetsQueryOptions,
} from './generated/metadata/metadata'
export type {
  Product,
  Category,
  Brand,
  CatalogFacets,
  ProductPage,
  ListProductsSort,
} from './generated/model'
export type { ListProductsParams } from './generated/operation'

export type {
  CatalogParams,
  CatalogSelection,
  CatalogResult,
  ProductResult,
  ComparisonResult,
  CatalogData,
  ToolResult,
  CatalogBridge,
} from './catalog-mcp'

export {
  createHttpShoppingClient,
  createMcpShoppingClient,
  shoppingRequest,
  ShoppingError,
} from './commerce'
export type {
  Cart,
  CartAction,
  Customer,
  Quote,
  Order,
  Attempt,
  ShoppingClient,
  ShoppingTarget,
  ShoppingScreen,
} from './commerce'
