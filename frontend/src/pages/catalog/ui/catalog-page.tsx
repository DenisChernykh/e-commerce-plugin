import Link from 'next/link'
import { Suspense } from 'react'

import { Container } from '@/shared/ui/container'
import { CatalogGrid, CatalogSkeleton } from '@/widgets/catalog'

export function CatalogPage() {
  return (
    <Container className="pt-7 md:pt-10">
      <nav
        aria-label="Хлебные крошки"
        className="mb-9 flex gap-3 text-[11px] text-muted-foreground"
      >
        <Link href="/">Главная</Link>
        <span>/</span>
        <span className="text-foreground">Каталог</span>
      </nav>
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow mb-4 text-muted-foreground">
            Для простых моментов
          </p>
          <h1 className="display-title">Для вашего дома</h1>
        </div>
        <p className="max-w-xs text-sm leading-7 text-muted-foreground">
          Натуральные фактуры, спокойные оттенки и немного повседневной красоты.
        </p>
      </div>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogGrid />
      </Suspense>
    </Container>
  )
}
