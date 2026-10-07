import { ArrowLeft, ArrowUpRight, Check, Circle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  loadProduct,
  loadRelatedProducts,
  ProductCard,
  ProductGallery,
} from '@/entities/product'
import { ApiProblemError } from '@/shared/api'
import { formatPrice } from '@/shared/lib/format'
import { routes } from '@/shared/routes'
import { Container } from '@/shared/ui/container'
import { AddToCart } from '@/features/shopping'

export async function ProductPage({ slug }: { slug: string }) {
  let product
  try {
    product = await loadProduct(slug)
  } catch (error) {
    if (error instanceof ApiProblemError && error.status === 404) notFound()
    throw error
  }
  const related = await loadRelatedProducts(slug)
  const details = [
    { name: 'Бренд', label: product.brand.name },
    { name: 'Материал', label: product.material.name },
    { name: 'Цвет', label: product.color.name },
    { name: 'Тип', label: product.type.name },
    ...product.attributes,
    { name: 'Артикул', label: product.sku },
  ]
  return (
    <Container className="pt-7 md:pt-10">
      <nav
        aria-label="Хлебные крошки"
        className="mb-8 flex flex-wrap gap-2 text-[11px] text-muted-foreground"
      >
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href={routes.catalog}>Каталог</Link>
        <span>/</span>
        <Link href={routes.category(product.category.slug)}>
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>
      <div className="grid items-start gap-9 md:grid-cols-[1.1fr_1fr] md:gap-14 lg:gap-20">
        <ProductGallery product={product} />
        <div className="md:pt-6">
          <Link
            href={`/catalog?brand=${product.brand.slug}`}
            className="eyebrow text-muted-foreground"
          >
            {product.brand.name}
          </Link>
          <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-[-0.02em] lg:text-6xl">
            {product.name}
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            {product.shortDescription}
          </p>
          <p className="mt-7 text-2xl">{formatPrice(product.price)}</p>
          <AddToCart
            productId={product.id}
            available={product.availability === 'in_stock'}
          />
          <p className="mt-4 flex items-center gap-2 text-xs">
            {product.availability === 'in_stock' ? (
              <>
                <Check className="size-3.5" />В наличии
              </>
            ) : (
              <>
                <Circle className="size-3" />
                Сейчас нет в наличии
              </>
            )}
          </p>
          <div className="mt-8 border-y py-5">
            <p className="mb-3 text-[10px] tracking-wider text-muted-foreground uppercase">
              Цвет · {product.color.name}
            </p>
            <span
              className="block size-7 rounded-full border-4 border-background ring-1 ring-border"
              style={{ background: product.color.hex }}
            />
          </div>
          <section className="mt-8" aria-labelledby="description">
            <h2 id="description" className="mb-3 text-sm font-medium">
              О предмете
            </h2>
            <p className="text-[13px] leading-7 text-muted-foreground">
              {product.description}
            </p>
          </section>
          <section className="mt-8" aria-labelledby="attributes">
            <h2 id="attributes" className="mb-3 text-sm font-medium">
              Детали и характеристики
            </h2>
            <dl>
              {details.map((detail) => (
                <div
                  key={detail.name}
                  className="flex justify-between gap-5 border-b py-3 text-xs"
                >
                  <dt className="text-muted-foreground">{detail.name}</dt>
                  <dd className="text-right">{detail.label}</dd>
                </div>
              ))}
            </dl>
          </section>
          <Link
            href={routes.category(product.category.slug)}
            className="mt-7 flex items-center justify-between border-b border-foreground/30 pb-3 text-xs"
          >
            Все предметы категории «{product.category.name}»
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
      {related.items.length > 0 && (
        <section className="mt-20 md:mt-28" aria-labelledby="related-heading">
          <div className="mb-9">
            <p className="eyebrow mb-4 text-muted-foreground">
              В том же настроении
            </p>
            <h2 id="related-heading" className="section-title">
              Возможно, вам понравится
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
            {related.items.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                action={
                  <AddToCart
                    productId={item.id}
                    available={item.availability === 'in_stock'}
                  />
                }
              />
            ))}
          </div>
        </section>
      )}
      <Link
        href={routes.catalog}
        className="mt-14 inline-flex items-center gap-3 text-xs"
      >
        <ArrowLeft className="size-4" />
        Вернуться в каталог
      </Link>
    </Container>
  )
}
