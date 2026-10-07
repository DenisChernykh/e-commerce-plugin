'use client'

import {
  Grid2X2,
  House,
  LayoutGrid,
  Plug,
  ShoppingBag,
  Package,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/shared/lib/utils'
import { routes } from '@/shared/routes'

export function StoreSidebar() {
  const pathname = usePathname()
  const links = [
    { href: routes.home, label: 'Главная', icon: House },
    { href: routes.catalog, label: 'Каталог', icon: LayoutGrid },
    { href: routes.categories, label: 'Категории', icon: Grid2X2 },
    { href: '/cart', label: 'Корзина', icon: ShoppingBag },
    { href: '/orders', label: 'Мои заказы', icon: Package },
    { href: routes.plugins, label: 'Плагины', icon: Plug },
  ]
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-44 flex-col border-r bg-background px-3 py-7 md:flex"
      aria-label="Сайдбар магазина"
    >
      <Link
        href="/"
        className="mb-9 px-3 font-serif text-4xl tracking-wider"
        aria-label="TIHO — главная"
      >
        tiho.
      </Link>
      <nav aria-label="Разделы магазина" className="space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== '/' && pathname?.startsWith(`${href}/`))
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded px-3 text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                active && 'bg-primary text-primary-foreground hover:bg-primary',
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>
      <p className="mt-auto px-3 text-[10px] leading-5 text-muted-foreground">
        Меньше суеты.
        <br />
        Больше дома.
      </p>
    </aside>
  )
}
