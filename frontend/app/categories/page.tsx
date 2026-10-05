import type { Metadata } from 'next'

import { CategoriesPage } from '@/pages/categories'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Категории' }
export default CategoriesPage
