export { ProductCard } from './ui/product-card'
export { ProductCardContent } from './ui/product-card-content'
export { ProductImage } from './ui/product-image'
export { ProductGallery } from './ui/product-gallery'
export { useProducts, useCatalogFacets } from './api/products'
export {
  loadProduct,
  loadCategories,
  loadFeaturedProducts,
  loadRelatedProducts,
} from './api/product-server'
export type {
  Product,
  Category,
  CatalogFacets,
  ListProductsParams,
  ListProductsSort,
} from '@/shared/api'
