'use client'
import { Check, LoaderCircle, ShoppingBag } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { useShopping } from './shopping-provider'
export function AddToCart({
  productId,
  available,
}: {
  productId: string
  available: boolean
}) {
  const { controller, cart, busy } = useShopping()
  const operation = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const quantity =
    cart?.items.find((line) => line.productId === productId)?.quantity ?? 0
  return (
    <div className="mt-4">
      <Button
        className="w-full"
        variant={quantity ? 'outline' : 'default'}
        disabled={!available || busy[productId]}
        onClick={() => {
          operation.current ??= crypto.randomUUID()
          setError(null)
          void controller
            .change({
              action: 'add',
              productId,
              quantity: 1,
              operationId: operation.current,
            })
            .then(
              () => {
                operation.current = null
              },
              (e: unknown) =>
                setError(
                  e instanceof Error ? e.message : 'Попробуйте ещё раз.',
                ),
            )
        }}
      >
        {busy[productId] ? (
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
        ) : quantity ? (
          <Check className="size-4" />
        ) : (
          <ShoppingBag className="size-4" />
        )}
        {busy[productId]
          ? 'Добавляем…'
          : !available
            ? 'Нет в наличии'
            : quantity
              ? `В корзине · ${quantity}`
              : 'Добавить в корзину'}
      </Button>
      {quantity > 0 && (
        <span role="status" className="sr-only">
          Товар в корзине, количество {quantity}
        </span>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
