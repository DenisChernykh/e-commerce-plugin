import type { ListProductsParams, ListProductsSort } from '@/entities/product'

export const sortOptions: { value: ListProductsSort; label: string }[] = [
  { value: 'recommended', label: 'Рекомендуем' },
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
  { value: 'newest', label: 'Сначала новинки' },
  { value: 'name_asc', label: 'По названию' },
]
export const multiFields = [
  'category',
  'brand',
  'color',
  'material',
  'type',
  'attribute',
] as const
export type MultiField = (typeof multiFields)[number]
export type FilterPatch = Partial<
  Record<keyof ListProductsParams, string | number | undefined>
>

export function parseCatalogParams(search: URLSearchParams): {
  params: ListProductsParams
  error?: string
} {
  const params: ListProductsParams = {}
  for (const field of multiFields) {
    const value = search
      .getAll(field)
      .flatMap((entry) => entry.split(','))
      .filter(Boolean)
    if (value.length) params[field] = [...new Set(value)].sort().join(',')
  }
  const query = search.get('q')?.trim()
  if (query) params.q = query
  for (const field of ['priceFrom', 'priceTo'] as const) {
    const raw = search.get(field)
    if (raw !== null && raw !== '') {
      if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw))
        return { params, error: 'Укажите корректную цену в рублях.' }
      params[field] = Number(raw)
    }
  }
  if (
    params.priceFrom !== undefined &&
    params.priceTo !== undefined &&
    params.priceFrom > params.priceTo
  )
    return {
      params,
      error: 'Минимальная цена не может быть больше максимальной.',
    }
  const availability = search.get('availability')
  if (availability === 'in_stock' || availability === 'out_of_stock')
    params.availability = availability
  const featured = search.get('featured')
  if (featured === 'true' || featured === 'false') params.featured = featured
  params.sort =
    sortOptions.find((option) => option.value === search.get('sort'))?.value ??
    'recommended'
  const page = Number(search.get('page') ?? 1)
  params.page = Number.isInteger(page) && page > 0 && page <= 10000 ? page : 1
  const pageSize = Number(search.get('pageSize') ?? 12)
  params.pageSize =
    Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 48 ? pageSize : 12
  return { params }
}

export function patchCatalogParams(
  search: URLSearchParams,
  patch: FilterPatch,
): string {
  const next = new URLSearchParams(search)
  if (!('page' in patch)) next.delete('page')
  for (const [key, value] of Object.entries(patch)) {
    if (
      value === undefined ||
      value === '' ||
      (key === 'page' && value === 1) ||
      (key === 'sort' && value === 'recommended')
    )
      next.delete(key)
    else next.set(key, String(value))
  }
  return next.toString()
}

export function toggleValue(current: string | undefined, value: string) {
  const values = new Set(current?.split(',').filter(Boolean) ?? [])
  if (values.has(value)) values.delete(value)
  else values.add(value)
  return [...values].sort().join(',') || undefined
}
