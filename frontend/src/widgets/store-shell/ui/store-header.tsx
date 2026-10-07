'use client'

import { ArrowUpRight, Menu, Plug, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { CartEntry } from '@/features/shopping'

import { cn } from '@/shared/lib/utils'
import { routes } from '@/shared/routes'
import { Button } from '@/shared/ui/button'
import { Container } from '@/shared/ui/container'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet'

const navigation = [
  { href: '/cart', label: 'Корзина' },
  { href: routes.catalog, label: 'Каталог' },
  { href: routes.categories, label: 'Категории' },
  { href: '/#philosophy', label: 'Философия TIHO' },
  { href: routes.plugins, label: 'Плагины' },
]

export function StoreHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="bg-primary py-2.5 text-center text-[9px] tracking-[0.16em] text-primary-foreground/90 uppercase">
        Меньше суеты. Больше дома.
      </div>
      <header className="border-b bg-background/95">
        <Container className="flex h-20 items-center justify-between md:h-24">
          <Link
            href={routes.home}
            aria-label="TIHO — на главную"
            className="font-serif text-[42px] leading-none tracking-[0.12em]"
          >
            tiho<span className="text-primary/50">.</span>
          </Link>
          <nav
            aria-label="Основная навигация"
            className="hidden items-center gap-9 md:flex"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'border-b border-transparent py-2 text-xs transition-colors hover:border-foreground',
                  pathname === item.href && 'border-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <CartEntry />
            <Link
              href="/catalog#search"
              className="flex size-10 items-center justify-center"
              aria-label="Поиск товаров"
            >
              <Search className="size-[19px]" strokeWidth={1.5} />
            </Link>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Открыть меню"
                  />
                }
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent className="p-5">
                <SheetHeader className="px-0">
                  <SheetTitle className="font-serif text-4xl">tiho.</SheetTitle>
                  <SheetDescription>
                    Предметы для жизни в своём ритме.
                  </SheetDescription>
                </SheetHeader>
                <nav
                  className="mt-8 flex flex-col"
                  aria-label="Мобильная навигация"
                >
                  {navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      className={cn(
                        'flex items-center justify-between border-b py-5 text-base',
                        pathname === item.href && 'font-semibold text-primary',
                      )}
                    >
                      <span className="flex items-center gap-3">
                        {item.href === routes.plugins && (
                          <Plug className="size-5" aria-hidden />
                        )}
                        {item.label}
                      </span>
                      <ArrowUpRight className="size-4" />
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </Container>
      </header>
    </>
  )
}
