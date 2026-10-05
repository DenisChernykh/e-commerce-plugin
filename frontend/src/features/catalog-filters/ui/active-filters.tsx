'use client'

import { X } from 'lucide-react'

import type { CatalogFacets, ListProductsParams } from '@/entities/product'
import { Button } from '@/shared/ui/button'

import {
  multiFields,
  type FilterPatch,
  type MultiField,
} from '../model/catalog-params'

export function ActiveFilters({
  params,
  facets,
  onToggle,
  onUpdate,
  onClear,
}: {
  params: ListProductsParams
  facets?: CatalogFacets
  onToggle: (field: MultiField, value: string) => void
  onUpdate: (patch: FilterPatch) => void
  onClear: () => void
}) {
  const options = {
    category: facets?.categories,
    brand: facets?.brands,
    color: facets?.colors,
    material: facets?.materials,
    type: facets?.types,
  }
  const chips: { key: string; label: string; remove: () => void }[] = []
  for (const field of multiFields) {
    for (const value of params[field]?.split(',') ?? []) {
      const [key, attributeValue] = value.split(':')
      const label =
        field === 'attribute'
          ? facets?.attributes
              .find((entry) => entry.key === key)
              ?.options.find((entry) => entry.slug === attributeValue)?.name
          : options[field]?.find((entry) => entry.slug === value)?.name
      chips.push({
        key: `${field}:${value}`,
        label: label ?? value,
        remove: () => onToggle(field, value),
      })
    }
  }
  if (params.q)
    chips.push({
      key: 'q',
      label: `«${params.q}»`,
      remove: () => onUpdate({ q: undefined }),
    })
  if (params.availability)
    chips.push({
      key: 'availability',
      label: params.availability === 'in_stock' ? 'В наличии' : 'Нет в наличии',
      remove: () => onUpdate({ availability: undefined }),
    })
  if (params.featured)
    chips.push({
      key: 'featured',
      label: params.featured === 'true' ? 'Выбор TIHO' : 'Другие предметы',
      remove: () => onUpdate({ featured: undefined }),
    })
  if (params.priceFrom !== undefined || params.priceTo !== undefined)
    chips.push({
      key: 'price',
      label: `${params.priceFrom ?? 0} — ${params.priceTo ?? '∞'} ₽`,
      remove: () => onUpdate({ priceFrom: undefined, priceTo: undefined }),
    })
  if (!chips.length) return null
  return (
    <div
      className="flex flex-wrap items-center gap-2 pb-5"
      aria-label="Выбранные фильтры"
    >
      {chips.map((chip) => (
        <Button
          key={chip.key}
          variant="secondary"
          className="h-8 gap-2 px-3 text-[11px]"
          onClick={chip.remove}
          aria-label={`Убрать фильтр: ${chip.label}`}
        >
          {chip.label}
          <X className="size-3" />
        </Button>
      ))}
      <Button
        variant="ghost"
        onClick={onClear}
        className="text-[11px] text-muted-foreground underline underline-offset-4"
      >
        Сбросить всё
      </Button>
    </div>
  )
}
