import { describe, expect, it } from 'vitest'

import {
  parseCatalogParams,
  patchCatalogParams,
  toggleValue,
} from './catalog-params'

describe('catalog URL contract', () => {
  it('restores a shared link without losing combinations, sort or pagination', () => {
    const result = parseCatalogParams(
      new URLSearchParams(
        'category=candles,diffusers&color=green,beige&material=soy&priceFrom=1000&priceTo=5000&sort=price_asc&page=2&q=кедр&attribute=aroma:woody',
      ),
    )
    expect(result.error).toBeUndefined()
    expect(result.params).toMatchObject({
      category: 'candles,diffusers',
      color: 'beige,green',
      material: 'soy',
      priceFrom: 1000,
      priceTo: 5000,
      sort: 'price_asc',
      page: 2,
      q: 'кедр',
      attribute: 'aroma:woody',
    })
  })
  it('resets pagination on filters and preserves independent filters', () => {
    const next = new URLSearchParams(
      patchCatalogParams(
        new URLSearchParams('page=4&brand=quiet-form&color=beige'),
        { category: 'candles', color: undefined },
      ),
    )
    expect(next.get('page')).toBeNull()
    expect(next.get('brand')).toBe('quiet-form')
    expect(next.get('category')).toBe('candles')
    expect(next.get('color')).toBeNull()
  })
  it('pagination keeps all selected filters', () => {
    expect(
      patchCatalogParams(new URLSearchParams('q=tea&category=candles'), {
        page: 2,
      }),
    ).toBe('q=tea&category=candles&page=2')
  })
  it('rejects invalid ranges and uses safe defaults for malformed pagination', () => {
    expect(
      parseCatalogParams(new URLSearchParams('priceFrom=5000&priceTo=1000'))
        .error,
    ).toBeDefined()
    expect(
      parseCatalogParams(new URLSearchParams('priceFrom=oops')).error,
    ).toBeDefined()
    expect(
      parseCatalogParams(new URLSearchParams('page=-1&pageSize=999&sort=nope'))
        .params,
    ).toMatchObject({ page: 1, pageSize: 12, sort: 'recommended' })
  })
  it('supports repeated URL keys and multi-selection without duplicates', () => {
    expect(
      parseCatalogParams(new URLSearchParams('color=beige&color=green,beige'))
        .params.color,
    ).toBe('beige,green')
    expect(toggleValue('beige,green', 'green')).toBe('beige')
    expect(toggleValue('beige', 'beige')).toBeUndefined()
    expect(toggleValue('beige', 'green')).toBe('beige,green')
  })
})
