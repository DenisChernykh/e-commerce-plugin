import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { routes } from '@/shared/routes'
import { Container } from '@/shared/ui/container'

import { StoreHeader } from './store-header'
import { StoreSidebar } from './store-sidebar'

export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <div className="md:pl-44">
      <StoreSidebar />
      <a
        href="#main-content"
        className="sr-only z-50 bg-background p-4 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Перейти к содержимому
      </a>
      <StoreHeader />
      <main id="main-content" className="min-h-[60vh]">
        {children}
      </main>
      <footer className="mt-20 border-t bg-secondary/40 md:mt-28">
        <Container>
          <div className="grid gap-9 py-12 md:grid-cols-[2fr_1fr_1fr] md:py-16">
            <div>
              <Link
                href={routes.home}
                className="font-serif text-5xl tracking-[0.1em]"
              >
                tiho.
              </Link>
              <p className="mt-5 max-w-xs text-xs leading-6 text-muted-foreground">
                Вещи, рядом с которыми хорошо.
                <br />
                Для дома. Для себя. Для простых моментов.
              </p>
            </div>
            <div>
              <p className="eyebrow mb-5">Исследовать</p>
              <div className="flex flex-col gap-3 text-xs">
                <Link href={routes.catalog}>Все предметы</Link>
                <Link href={routes.categories}>Категории</Link>
                <Link href="/catalog?featured=true">Выбор TIHO</Link>
              </div>
            </div>
            <div>
              <p className="eyebrow mb-5">О магазине</p>
              <p className="max-w-xs text-xs leading-6 text-muted-foreground">
                Небольшая коллекция для осознанного дома. Сейчас доступен
                просмотр каталога; покупки появятся позже.
              </p>
              <Link
                href="/#philosophy"
                className="mt-4 inline-flex items-center gap-2 text-xs"
              >
                Наша философия <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t py-5 text-[10px] text-muted-foreground">
            <span>© 2026 TIHO. Пространство для спокойной жизни.</span>
            <span>Демонстрационный магазин</span>
          </div>
        </Container>
      </footer>
    </div>
  )
}
