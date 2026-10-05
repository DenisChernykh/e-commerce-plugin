'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  getGetCatalogFacetsQueryOptions,
  getListProductsQueryOptions,
  type ListProductsParams,
} from '@/shared/api'

export function useProducts(params: ListProductsParams, enabled = true) {
  return useQuery({
    ...getListProductsQueryOptions(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useCatalogFacets(category?: string) {
  return useQuery(
    getGetCatalogFacetsQueryOptions(category ? { category } : undefined),
  )
}
