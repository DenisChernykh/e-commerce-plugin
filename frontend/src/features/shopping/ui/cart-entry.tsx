'use client'
import { ShoppingBag } from 'lucide-react'
import { useShopping } from './shopping-provider'
export function CartEntry({ onClick }: { onClick?: () => void }) {
  const { cart } = useShopping()
  const label = `Корзина${cart?.itemCount ? `, ${cart.itemCount}` : ''}`
  const content = (
    <>
      <ShoppingBag className="size-5" strokeWidth={1.5} />
      <span className="text-xs">{cart?.itemCount ?? 0}</span>
    </>
  )
  const className =
    'inline-flex h-10 items-center gap-2 px-2 focus-visible:ring-2 focus-visible:ring-ring'
  return onClick ? (
    <button className={className} aria-label={label} onClick={onClick}>
      {content}
    </button>
  ) : (
    <a href="/cart" className={className} aria-label={label}>
      {content}
    </a>
  )
}
