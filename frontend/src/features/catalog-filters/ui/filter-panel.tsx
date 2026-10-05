'use client'

import { useId, useState } from 'react'

import type { CatalogFacets, ListProductsParams } from '@/entities/product'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'

import type { FilterPatch, MultiField } from '../model/catalog-params'

type FilterPanelProps = {
  params: ListProductsParams
  facets: CatalogFacets
  onUpdate: (patch: FilterPatch) => void
  onToggle: (field: MultiField, value: string) => void
}

function PriceFilter({
  params,
  facets,
  onUpdate,
}: Omit<FilterPanelProps, 'onToggle'>) {
  const [error, setError] = useState('')
  const identifier = useId()
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const from = String(data.get('priceFrom') ?? '').trim()
        const to = String(data.get('priceTo') ?? '').trim()
        if (from && to && Number(from) > Number(to)) {
          setError('Цена «от» должна быть меньше цены «до».')
          return
        }
        setError('')
        onUpdate({ priceFrom: from || undefined, priceTo: to || undefined })
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={`${identifier}-from`}
            className="mb-1.5 block text-[11px] text-muted-foreground"
          >
            От, ₽
          </label>
          <Input
            id={`${identifier}-from`}
            name="priceFrom"
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            defaultValue={params.priceFrom ?? ''}
            placeholder={String(facets.price.min)}
            className="h-10 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor={`${identifier}-to`}
            className="mb-1.5 block text-[11px] text-muted-foreground"
          >
            До, ₽
          </label>
          <Input
            id={`${identifier}-to`}
            name="priceTo"
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            defaultValue={params.priceTo ?? ''}
            placeholder={String(facets.price.max)}
            className="h-10 text-sm"
          />
        </div>
      </div>
      {Boolean(error) && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="mt-3 h-9 w-full">
        Применить цену
      </Button>
    </form>
  )
}

export function FilterPanel({
  params,
  facets,
  onUpdate,
  onToggle,
}: FilterPanelProps) {
  const identifier = useId()
  const groups: {
    field: MultiField
    name: string
    options: CatalogFacets['colors']
  }[] = [
    { field: 'category', name: 'Категория', options: facets.categories },
    { field: 'brand', name: 'Бренд', options: facets.brands },
    { field: 'color', name: 'Цвет', options: facets.colors },
    { field: 'material', name: 'Материал', options: facets.materials },
    { field: 'type', name: 'Тип предмета', options: facets.types },
  ]
  function choices(
    field: MultiField,
    options: CatalogFacets['colors'],
    prefix = '',
  ) {
    return (
      <div className="max-h-64 space-y-3 overflow-y-auto py-2 pr-1">
        {options.map((option) => {
          const value = `${prefix}${option.slug}`
          const id = `${identifier}-${field}-${value}`
          return (
            <div key={value} className="flex items-center gap-3">
              <Checkbox
                id={id}
                checked={params[field]?.split(',').includes(value) ?? false}
                onCheckedChange={() => onToggle(field, value)}
              />
              <label
                htmlFor={id}
                className="flex min-h-6 flex-1 cursor-pointer items-center gap-2 text-xs leading-5"
              >
                {Boolean(option.hex) && (
                  <span
                    className="size-3 rounded-full border border-black/10"
                    style={{ background: option.hex }}
                  />
                )}
                <span className="flex-1">{option.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {option.count}
                </span>
              </label>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="pb-6">
      <Accordion multiple defaultValue={['category', 'price', 'color']}>
        {groups.map((group, index) => (
          <AccordionItem key={group.field} value={group.field}>
            <AccordionTrigger className="py-5 text-[13px]">
              {group.name}
            </AccordionTrigger>
            <AccordionContent>
              {choices(group.field, group.options)}
            </AccordionContent>
            {index === 0 && (
              <div className="flex items-center gap-3 pt-2 pb-5">
                <Checkbox
                  id={`${identifier}-stock`}
                  checked={params.availability === 'in_stock'}
                  onCheckedChange={(checked) =>
                    onUpdate({ availability: checked ? 'in_stock' : undefined })
                  }
                />
                <label
                  htmlFor={`${identifier}-stock`}
                  className="cursor-pointer text-xs"
                >
                  Только в наличии
                </label>
              </div>
            )}
          </AccordionItem>
        ))}
        <AccordionItem value="price">
          <AccordionTrigger className="py-5 text-[13px]">Цена</AccordionTrigger>
          <AccordionContent>
            <PriceFilter
              key={`${params.priceFrom}-${params.priceTo}`}
              params={params}
              facets={facets}
              onUpdate={onUpdate}
            />
          </AccordionContent>
        </AccordionItem>
        {facets.attributes
          .filter((attribute) => attribute.key !== 'care')
          .map((attribute) => (
            <AccordionItem key={attribute.key} value={`attr-${attribute.key}`}>
              <AccordionTrigger className="py-5 text-[13px]">
                {attribute.name}
              </AccordionTrigger>
              <AccordionContent>
                {choices('attribute', attribute.options, `${attribute.key}:`)}
              </AccordionContent>
            </AccordionItem>
          ))}
      </Accordion>
    </div>
  )
}
