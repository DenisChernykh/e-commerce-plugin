import { cache } from 'react'

import {
  getProduct,
  getRelatedProducts,
  listCategories,
  listProducts,
} from '@/shared/api'

export const loadProduct = cache((identifier: string) =>
  getProduct({ identifier }),
)
export const loadCategories = cache(() => listCategories())
export const loadFeaturedProducts = cache(() =>
  listProducts({ featured: 'true', pageSize: 8 }),
)
export const loadRelatedProducts = cache((identifier: string) =>
  getRelatedProducts({ identifier }, { limit: 4 }),
)
