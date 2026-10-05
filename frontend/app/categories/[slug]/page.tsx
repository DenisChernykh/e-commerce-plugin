import { notFound, redirect } from 'next/navigation'

import { loadCategories } from '@/entities/product'
import { routes } from '@/shared/routes'

export const dynamic = 'force-dynamic'
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { items } = await loadCategories()
  if (!items.some((category) => category.slug === slug)) notFound()
  redirect(routes.category(slug))
}
