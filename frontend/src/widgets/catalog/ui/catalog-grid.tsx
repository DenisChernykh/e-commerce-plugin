'use client'

import { ArrowLeft, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { ProductCard, useCatalogFacets, useProducts } from '@/entities/product'
import { AddToCart } from '@/features/shopping'
import {
  ActiveFilters,
  FilterPanel,
  SearchForm,
  sortOptions,
  useCatalogFilters,
} from '@/features/catalog-filters'
import { ApiProblemError } from '@/shared/api'
import { productCount } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet'
import { Skeleton } from '@/shared/ui/skeleton'

export function CatalogSkeleton() {
  return (
    <div
      aria-label="Загрузка товаров"
      className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-3"
    >
      {['one', 'two', 'three', 'four', 'five', 'six'].map((key) => (
        <div key={key}>
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function CatalogGrid() {
  const filters = useCatalogFilters()
  const { params } = filters
  const products = useProducts(params, !filters.error)
  const facets = useCatalogFacets(params.category)
  const [mobileOpen, setMobileOpen] = useState(false)
  const data = products.data
  const isInvalid =
    Boolean(filters.error) ||
    (products.error instanceof ApiProblemError && products.error.status === 400)
  const filterPanel = facets.data ? (
    <FilterPanel
      params={params}
      facets={facets.data}
      onUpdate={filters.update}
      onToggle={filters.toggle}
    />
  ) : (
    <div className="space-y-6 py-6">
      {facets.isError ? (
        <p className="text-xs">
          Не удалось загрузить фильтры.{' '}
          <Button variant="link" onClick={() => facets.refetch()}>
            Повторить
          </Button>
        </p>
      ) : (
        <>
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
          <Skeleton className="h-36" />
        </>
      )}
    </div>
  )
  function changePage(page: number) {
    filters.update({ page })
    document
      .getElementById('catalog-results')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div>
      <div className="mb-9 max-w-2xl">
        <SearchForm
          key={params.q ?? ''}
          value={params.q}
          onSearch={(q) => filters.update({ q })}
        />
      </div>
      <div className="grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)] xl:gap-14">
        <aside className="hidden lg:block" aria-label="Фильтры каталога">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-sm font-medium">Фильтры</h2>
            <Button
              variant="ghost"
              onClick={filters.clear}
              className="h-auto p-0 text-[10px] text-muted-foreground"
            >
              Сбросить
            </Button>
          </div>
          {filterPanel}
        </aside>
        <section
          id="catalog-results"
          className="min-w-0 scroll-mt-6"
          aria-label="Результаты поиска"
        >
          <div className="mb-5 flex min-h-10 flex-wrap items-center justify-between gap-3 border-b pb-4">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {products.isFetching
                ? 'Подбираем предметы…'
                : data
                  ? productCount(data.pagination.total)
                  : 'Коллекция TIHO'}
            </p>
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button variant="outline" className="h-9 gap-2 lg:hidden" />
                  }
                >
                  <SlidersHorizontal className="size-4" />
                  Фильтры
                </SheetTrigger>
                <SheetContent side="left" className="flex w-[90%] flex-col">
                  <SheetHeader>
                    <SheetTitle>Фильтры</SheetTitle>
                    <SheetDescription>
                      Выберите то, что подходит вашему дому.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto px-5">
                    {filterPanel}
                  </div>
                  <SheetFooter>
                    <Button
                      className="h-11"
                      onClick={() => setMobileOpen(false)}
                    >
                      Показать{' '}
                      {data ? productCount(data.pagination.total) : 'предметы'}
                    </Button>
                    <Button variant="ghost" onClick={filters.clear}>
                      Сбросить фильтры
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <Select
                value={params.sort}
                onValueChange={(value) => {
                  if (value) filters.update({ sort: value })
                }}
                items={sortOptions}
              >
                <SelectTrigger
                  aria-label="Сортировка"
                  className="h-9 min-w-36 border-0 px-0 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" alignItemWithTrigger={false}>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ActiveFilters
            params={params}
            facets={facets.data}
            onToggle={filters.toggle}
            onUpdate={filters.update}
            onClear={filters.clear}
          />
          {isInvalid ? (
            <EmptyState
              title="Проверим фильтры"
              description={
                filters.error ??
                'В ссылке есть неподдерживаемые параметры. Сбросьте фильтры и попробуйте ещё раз.'
              }
              action={<Button onClick={filters.clear}>Сбросить фильтры</Button>}
            />
          ) : products.isError ? (
            <EmptyState
              title="Каталог немного задерживается"
              description="Не удалось получить товары. Попробуйте загрузить их ещё раз."
              action={
                <Button onClick={() => products.refetch()}>Повторить</Button>
              }
            />
          ) : products.isPending ? (
            <CatalogSkeleton />
          ) : data && data.items.length === 0 ? (
            <EmptyState
              title={
                data.pagination.total > 0
                  ? 'Эта страница пуста'
                  : 'Пока ничего не нашлось'
              }
              description={
                data.pagination.total > 0
                  ? 'Вернитесь на первую страницу, чтобы увидеть найденные предметы.'
                  : 'Попробуйте другой запрос или уберите несколько фильтров. Возможно, нужная вещь совсем рядом.'
              }
              action={
                <Button
                  onClick={
                    data.pagination.total > 0
                      ? () => changePage(1)
                      : filters.clear
                  }
                >
                  {data.pagination.total > 0
                    ? 'На первую страницу'
                    : 'Сбросить фильтры'}
                </Button>
              }
            />
          ) : (
            <div
              className="grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity md:gap-x-6 lg:grid-cols-3"
              aria-busy={products.isFetching}
              style={{ opacity: products.isPlaceholderData ? 0.5 : 1 }}
            >
              {data?.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  action={
                    <AddToCart
                      productId={product.id}
                      available={product.availability === 'in_stock'}
                    />
                  }
                />
              ))}
            </div>
          )}
          {data &&
            data.pagination.totalPages > 1 &&
            !products.isError &&
            !isInvalid && (
              <nav
                aria-label="Страницы каталога"
                className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6"
              >
                <Button
                  variant="ghost"
                  aria-label="Предыдущая страница"
                  disabled={(params.page ?? 1) <= 1 || products.isFetching}
                  onClick={() => changePage((params.page ?? 1) - 1)}
                >
                  <ArrowLeft className="size-4" />
                  <span className="hidden sm:inline">Назад</span>
                </Button>
                <div className="flex gap-1">
                  {Array.from(
                    { length: data.pagination.totalPages },
                    (_, index) => index + 1,
                  )
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === data.pagination.totalPages ||
                        Math.abs(page - (params.page ?? 1)) <= 1,
                    )
                    .map((page, index, pages) => (
                      <span
                        key={page}
                        className="inline-flex items-center gap-1"
                      >
                        {index > 0 && page - (pages[index - 1] ?? 0) > 1 && (
                          <span className="px-1 text-xs">…</span>
                        )}
                        <Button
                          variant={params.page === page ? 'default' : 'ghost'}
                          size="icon"
                          disabled={products.isFetching}
                          aria-label={`Страница ${page}`}
                          aria-current={
                            params.page === page ? 'page' : undefined
                          }
                          onClick={() => changePage(page)}
                        >
                          {page}
                        </Button>
                      </span>
                    ))}
                </div>
                <Button
                  variant="ghost"
                  aria-label="Следующая страница"
                  disabled={
                    (params.page ?? 1) >= data.pagination.totalPages ||
                    products.isFetching
                  }
                  onClick={() => changePage((params.page ?? 1) + 1)}
                >
                  <span className="hidden sm:inline">Дальше</span>
                  <ArrowRight className="size-4" />
                </Button>
              </nav>
            )}
        </section>
      </div>
    </div>
  )
}
