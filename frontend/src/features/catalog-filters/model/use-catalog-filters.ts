'use client'

import { useSearchParams } from 'next/navigation'

import {
  parseCatalogParams,
  patchCatalogParams,
  toggleValue,
  type FilterPatch,
  type MultiField,
} from './catalog-params'

export function useCatalogFilters() {
  const search = useSearchParams()
  const parsed = parseCatalogParams(
    new URLSearchParams(search?.toString() ?? ''),
  )
  function update(patch: FilterPatch) {
    const query = patchCatalogParams(
      new URLSearchParams(window.location.search),
      patch,
    )
    window.history.pushState(null, '', query ? `/catalog?${query}` : '/catalog')
  }
  function toggle(field: MultiField, value: string) {
    const live = new URLSearchParams(window.location.search)
    const current = live.getAll(field).join(',')
    update({ [field]: toggleValue(current, value) })
  }
  function clear() {
    window.history.pushState(null, '', '/catalog')
  }
  return { ...parsed, update, toggle, clear }
}
