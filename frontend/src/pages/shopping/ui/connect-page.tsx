'use client'
import { useEffect, useState } from 'react'
import { shoppingRequest } from '@/shared/api'
import { Container } from '@/shared/ui/container'
import { Skeleton } from '@/shared/ui/skeleton'
// Shared promise prevents React StrictMode from consuming a one-use code twice.
let exchange: Promise<{ target: string }> | undefined
export function ConnectPage() {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const code = new URLSearchParams(location.hash.slice(1)).get('code')
    history.replaceState(null, '', '/connect')
    if (!exchange && code)
      exchange = shoppingRequest('/session/exchange', { code })
    if (!exchange)
      exchange = Promise.reject(
        new Error(
          'Ссылка уже использована. Откройте магазин из TIHO в ChatGPT ещё раз.',
        ),
      )
    void exchange.then(
      ({ target }) => {
        location.replace(target)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : 'Не удалось открыть корзину.')
        exchange = undefined
      },
    )
  }, [])
  return (
    <Container className="max-w-2xl py-16">
      <h1 className="font-serif text-4xl">Открываем вашу корзину</h1>
      {error ? (
        <p role="alert" className="mt-6 text-sm">
          {error}
        </p>
      ) : (
        <div className="mt-8 space-y-4" role="status">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </Container>
  )
}
