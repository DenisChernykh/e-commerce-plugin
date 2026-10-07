'use client'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckoutFlow } from '@/widgets/checkout'
import type { ShoppingTarget } from '@/shared/api'
export function ShoppingPage({ screen, orderId }: ShoppingTarget) {
  const router = useRouter()
  const navigate = useCallback(
    (target: ShoppingTarget) => {
      const id = target.orderId ?? target.order?.id
      router.push(
        target.screen === 'cart'
          ? '/cart'
          : target.screen === 'checkout'
            ? '/checkout'
            : target.screen === 'orders'
              ? '/orders'
              : `/orders/${id}${target.screen === 'payment' ? '/payment' : ''}`,
      )
    },
    [router],
  )
  return (
    <CheckoutFlow
      key={`${screen}:${orderId ?? ''}`}
      target={{ screen, orderId }}
      navigate={navigate}
      continueShopping={() => router.push('/catalog')}
    />
  )
}
