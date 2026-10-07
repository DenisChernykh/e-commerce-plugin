import {
  ArrowLeft,
  ArrowUpRight,
  Maximize2,
  SlidersHorizontal,
} from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { AddToCart, CartEntry, useShopping } from '@/features/shopping'
import {
  ProductCardContent,
  ProductImage,
  type CatalogFacets,
} from '@/entities/product'
import {
  ActiveFilters,
  FilterPanel,
  sortOptions,
  toggleValue,
  type FilterPatch,
  type MultiField,
} from '@/features/catalog-filters'
import type { CatalogBridge, ProductResult } from '@/shared/api'
import { formatPrice } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import type { CatalogController } from '../model/controller'

function ProductDetails({
  product,
  bridge,
}: {
  product: ProductResult['product']
  bridge: CatalogBridge
}) {
  return (
    <article className="grid gap-6 sm:grid-cols-2">
      <div>
        <ProductImage product={product} className="aspect-[4/5] w-full" />
        {!product.images.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Иллюстрация · фотография пока не добавлена
          </p>
        )}
      </div>
      <div className="space-y-4">
        <p className="eyebrow">{product.brand.name}</p>
        <h2 className="font-serif text-4xl">{product.name}</h2>
        <p className="text-lg">{formatPrice(product.price)}</p>
        <AddToCart
          productId={product.id}
          available={product.availability === 'in_stock'}
        />
        <p className="text-sm">
          {product.availability === 'in_stock' ? 'В наличии' : 'Нет в наличии'}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {product.description}
        </p>
        <dl className="space-y-3 text-sm">
          {[
            ['Материал', product.material.name],
            ['Цвет', product.color.name],
            ...product.attributes.map((a) => [a.name, a.label]),
          ].map(([name, value]) => (
            <div
              key={name}
              className="flex justify-between gap-4 border-b pb-2"
            >
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <Button onClick={() => void bridge.openLink(product.url)}>
          Открыть на сайте <ArrowUpRight className="size-4" />
        </Button>
      </div>
    </article>
  )
}

export function ChatgptCatalog({
  controller,
  bridge,
}: {
  controller: CatalogController
  bridge: CatalogBridge
}) {
  const { controller: shopping } = useShopping()
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  )
  const [facets, setFacets] = useState<CatalogFacets>()
  const [facetError, setFacetError] = useState(false)
  const [facetAttempt, setFacetAttempt] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const data = state.data
  const params = state.catalog?.selection.params
  useEffect(() => {
    let active = true
    void bridge
      .callTool('get_catalog_filters', { category: params?.category })
      .then(
        (result) => {
          if (!active) return
          if (result.isError || !result.structuredContent?.data) {
            setFacetError(true)
            return
          }
          setFacets(result.structuredContent.data as CatalogFacets)
          setFacetError(false)
        },
        () => {
          if (active) setFacetError(true)
        },
      )
    return () => {
      active = false
    }
  }, [bridge, params?.category, facetAttempt])
  function update(patch: FilterPatch) {
    const changes = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        value === undefined || value === ''
          ? null
          : key === 'priceFrom' || key === 'priceTo'
            ? Number(value)
            : value,
      ]),
    )
    void controller.search(changes)
  }
  function toggle(field: MultiField, value: string) {
    update({ [field]: toggleValue(params?.[field], value) })
  }
  return (
    <main
      className="mx-auto max-w-6xl p-4 sm:p-6"
      aria-label="Каталог TIHO в ChatGPT"
    >
      <header className="mb-5 flex items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="font-serif text-4xl tracking-wider">tiho.</h1>
          <p className="text-xs text-muted-foreground">
            Предметы для тихих моментов
          </p>
        </div>
        <div className="flex gap-2">
          <CartEntry onClick={() => shopping.open({ screen: 'cart' })} />
          {(state.history.length > 0 ||
            state.previousSelections.length > 0 ||
            (data?.view !== 'catalog' &&
              (state.catalog || data?.selection))) && (
            <Button variant="outline" onClick={controller.back}>
              <ArrowLeft className="size-4" />К подборке
            </Button>
          )}
          {bridge.fullscreen && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Развернуть каталог"
              onClick={() => void bridge.fullscreen?.()}
            >
              <Maximize2 className="size-4" />
            </Button>
          )}
        </div>
      </header>
      {state.contextError && (
        <div role="alert" className="mb-4 border p-3 text-sm">
          Не удалось передать текущую подборку в разговор. Указывайте название
          товара до восстановления связи.{' '}
          <Button variant="outline" onClick={controller.sync}>
            Повторить синхронизацию
          </Button>
        </div>
      )}
      {state.error && (
        <div
          role="alert"
          className="mb-4 border border-destructive p-4 text-sm"
        >
          <p>{state.error}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void controller.retry()}
          >
            Повторить запрос
          </Button>
        </div>
      )}
      {state.loading && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Загружаем данные каталога…
        </p>
      )}
      {!data && !state.loading && !state.error && (
        <p>Откройте каталог через TIHO в разговоре.</p>
      )}
      {data?.view === 'catalog' && params && (
        <>
          <form
            key={params.q ?? ''}
            className="mb-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              update({
                q: String(
                  new FormData(event.currentTarget).get('q') ?? '',
                ).trim(),
              })
            }}
          >
            <Input
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Свеча, кедр, лён…"
              aria-label="Поиск товаров"
              maxLength={160}
            />
            <Button type="submit">Найти</Button>
          </form>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setFiltersOpen(!filtersOpen)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="size-4" />
              Фильтры
            </Button>
            <label className="flex items-center gap-2 text-xs">
              Сортировка
              <select
                aria-label="Сортировка"
                className="max-w-48 border bg-background p-2"
                value={params.sort}
                onChange={(event) => update({ sort: event.target.value })}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ActiveFilters
            params={params}
            facets={facets}
            onUpdate={update}
            onToggle={toggle}
            onClear={() =>
              void controller.search(
                {},
                { page: 1, pageSize: params.pageSize, sort: 'recommended' },
              )
            }
          />
          <div
            className={
              filtersOpen ? 'grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)]' : ''
            }
          >
            {filtersOpen && (
              <aside aria-label="Фильтры каталога">
                {facets && (
                  <FilterPanel
                    params={params}
                    facets={facets}
                    onUpdate={update}
                    onToggle={toggle}
                  />
                )}
                {facetError && (
                  <p role="alert">
                    Фильтры не загрузились.{' '}
                    <Button
                      variant="outline"
                      onClick={() => setFacetAttempt(facetAttempt + 1)}
                    >
                      Повторить
                    </Button>
                  </p>
                )}
              </aside>
            )}
            <section
              className="min-w-0"
              aria-label="Подборка товаров"
              aria-busy={state.loading}
            >
              <p className="mb-4 text-xs text-muted-foreground">
                Найдено: {data.pagination.total} · Страница{' '}
                {data.pagination.page} · Показано: {data.returned}
              </p>
              {data.items.length === 0 ? (
                <div className="border p-8 text-center">
                  <h2 className="font-serif text-3xl">Ничего не найдено</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Попробуйте изменить один из фильтров. Остальные условия
                    сохранятся.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-3">
                  {data.items.map((product, index) => (
                    <article key={product.id} className="min-w-0">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Вариант {index + 1}
                      </p>
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => void controller.open(index + 1)}
                        aria-label={`Открыть вариант ${index + 1}: ${product.name}`}
                      >
                        <ProductCardContent product={product} />
                      </button>
                      <AddToCart
                        productId={product.id}
                        available={product.availability === 'in_stock'}
                      />
                      {!product.images.length && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Иллюстрация
                        </p>
                      )}
                      <label className="mt-3 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={state.selectedIds.includes(product.id)}
                          disabled={
                            !state.selectedIds.includes(product.id) &&
                            state.selectedIds.length >= 4
                          }
                          onChange={() => controller.select(product.id)}
                        />
                        Сравнить {index + 1}
                      </label>
                    </article>
                  ))}
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                {data.next && (
                  <Button
                    disabled={state.loading}
                    onClick={() => void controller.next()}
                  >
                    Показать ещё
                  </Button>
                )}
                {state.selectedIds.length > 0 && (
                  <Button
                    variant="outline"
                    disabled={state.selectedIds.length < 2 || state.loading}
                    onClick={() => void controller.compare()}
                  >
                    Сравнить выбранные ({state.selectedIds.length})
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => void bridge.openLink(data.catalogUrl)}
                >
                  Подборка на сайте <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </section>
          </div>
        </>
      )}
      {data?.view === 'product' && (
        <ProductDetails product={data.product} bridge={bridge} />
      )}
      {data?.view === 'compare' && (
        <section aria-label="Сравнение товаров">
          <h2 className="mb-5 font-serif text-3xl">Сравнение</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Характеристика</th>
                  {data.products.map((p) => (
                    <th key={p.id} className="min-w-40 p-3">
                      <ProductImage
                        product={p}
                        className="mb-3 aspect-square w-32"
                      />
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    key: 'price',
                    name: 'Цена',
                    values: data.products.map((p) => formatPrice(p.price)),
                  },
                  {
                    key: 'stock',
                    name: 'Наличие',
                    values: data.products.map((p) =>
                      p.availability === 'in_stock'
                        ? 'В наличии'
                        : 'Нет в наличии',
                    ),
                  },
                  {
                    key: 'material',
                    name: 'Материал',
                    values: data.products.map((p) => p.material.name),
                  },
                  {
                    key: 'color',
                    name: 'Цвет',
                    values: data.products.map((p) => p.color.name),
                  },
                  ...Array.from(
                    new Map(
                      data.products.flatMap((p) =>
                        p.attributes.map((a) => [a.key, a.name] as const),
                      ),
                    ),
                  ).map(([key, name]) => ({
                    key,
                    name,
                    values: data.products.map(
                      (p) =>
                        p.attributes.find((a) => a.key === key)?.label ??
                        'Нет данных',
                    ),
                  })),
                ].map((row) => (
                  <tr key={row.key} className="border-t">
                    <th className="p-3 font-normal text-muted-foreground">
                      {row.name}
                    </th>
                    {row.values.map((value, index) => (
                      <td key={data.products[index]!.id} className="p-3">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t">
                  <th className="p-3 font-normal">В магазине</th>
                  {data.products.map((p) => (
                    <td key={p.id} className="p-3">
                      <Button
                        variant="outline"
                        onClick={() => void bridge.openLink(p.url)}
                      >
                        Открыть <ArrowUpRight className="size-4" />
                      </Button>
                      <AddToCart
                        productId={p.id}
                        available={p.availability === 'in_stock'}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Сравнение характеристик каталога. Рекомендация в разговоре зависит
            от ваших критериев.
          </p>
        </section>
      )}
    </main>
  )
}
