import type { Metadata } from 'next'

import { loadProduct } from '@/entities/product'
import { ProductPage } from '@/pages/product'
import { ApiProblemError } from '@/shared/api'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  try {
    const product = await loadProduct(slug)
    return { title: product.name, description: product.shortDescription }
  } catch (error) {
    if (error instanceof ApiProblemError && error.status === 404)
      return { title: 'Предмет не найден' }
    return { title: 'Каталог' }
  }
}

export default async function Page({ params }: Props) {
  return <ProductPage slug={(await params).slug} />
}
