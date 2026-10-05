import Link from 'next/link'
import type { Product } from '@/shared/api'
import { formatPrice } from '@/shared/lib/format'
import { routes } from '@/shared/routes'
import { ProductCardContent } from './product-card-content'

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group min-w-0">
      <Link
        href={routes.product(product.slug)}
        className="block"
        aria-label={`${product.name}, ${formatPrice(product.price)}`}
      >
        <ProductCardContent product={product} />
      </Link>
    </article>
  )
}
