'use client'

import { useState } from 'react'

import type { Product } from '@/shared/api'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { ProductImage } from './product-image'

export function ProductGallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0)
  return (
    <div>
      <ProductImage
        product={product}
        imageIndex={index}
        className="aspect-[4/4.5] w-full"
        priority
      />
      {product.images.length > 1 && (
        <div className="mt-3 flex gap-3" aria-label="Изображения товара">
          {product.images.map((image, imageIndex) => (
            <Button
              key={image.id}
              variant="ghost"
              className={cn(
                'h-auto w-20 p-0',
                index === imageIndex && 'ring-1 ring-foreground',
              )}
              onClick={() => setIndex(imageIndex)}
              aria-label={`Изображение ${imageIndex + 1}`}
              aria-pressed={index === imageIndex}
            >
              <ProductImage
                product={product}
                imageIndex={imageIndex}
                className="aspect-square w-full"
              />
            </Button>
          ))}
        </div>
      )}
      {product.images.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Иллюстрация товара. Фотографии появятся позже.
        </p>
      )}
    </div>
  )
}
