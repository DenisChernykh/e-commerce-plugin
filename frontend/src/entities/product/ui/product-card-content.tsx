import type { Product } from '@/shared/api'
import { formatPrice } from '@/shared/lib/format'
import { ProductImage } from './product-image'

export type ProductPreview = Pick<
  Product,
  | 'id'
  | 'name'
  | 'price'
  | 'brand'
  | 'color'
  | 'material'
  | 'category'
  | 'type'
  | 'images'
  | 'featured'
  | 'availability'
>

export function ProductCardContent({ product }: { product: ProductPreview }) {
  return (
    <>
      <div className="relative mb-4 overflow-hidden">
        <ProductImage product={product} className="aspect-[4/5] w-full" />
        {product.featured && (
          <span className="absolute top-3 left-3 bg-background/90 px-2.5 py-1.5 text-[9px] tracking-wider uppercase">
            Выбор TIHO
          </span>
        )}
      </div>
      <p className="mb-1.5 text-[10px] tracking-[0.13em] text-muted-foreground uppercase">
        {product.brand.name}
      </p>
      <h3 className="text-sm leading-6 font-medium md:text-[15px]">
        {product.name}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {product.material.name} · {product.color.name}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {formatPrice(product.price)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {product.availability === 'in_stock' ? 'В наличии' : 'Нет в наличии'}
        </span>
      </div>
    </>
  )
}
