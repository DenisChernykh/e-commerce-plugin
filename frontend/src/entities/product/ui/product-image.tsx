'use client'

import { useState } from 'react'

import type { Product } from '@/shared/api'
import { cn } from '@/shared/lib/utils'
import { ObjectArt } from '@/shared/ui/object-art'

export function ProductImage({
  product,
  imageIndex = 0,
  className,
  priority = false,
}: {
  product: Pick<Product, 'images' | 'category' | 'type' | 'color'>
  imageIndex?: number
  className?: string
  priority?: boolean
}) {
  const image = product.images[imageIndex]
  const [failedUrl, setFailedUrl] = useState<string>()
  if (!image || image.url === failedUrl)
    return (
      <ObjectArt
        category={product.category.slug}
        type={product.type.slug}
        color={product.color.hex}
        className={className}
      />
    )
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      <img
        src={image.url}
        alt={image.alt}
        className="absolute inset-0 h-full w-full object-cover"
        loading={priority ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(image.url)}
      />
    </div>
  )
}
