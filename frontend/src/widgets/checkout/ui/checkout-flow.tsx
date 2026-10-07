'use client'
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useShopping } from '@/features/shopping'
import { ProductImage } from '@/entities/product'
import {
  ShoppingError,
  type Cart,
  type CartAction,
  type Customer,
  type Order,
  type Quote,
  type ShoppingTarget,
} from '@/shared/api'
import { formatPrice, productCount } from '@/shared/lib/format'
import { pollWhileVisible } from '@/shared/lib/visible-polling'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

const money = (value: number, currency: string) =>
  formatPrice(value / 100, currency)
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : 'Не удалось выполнить действие. Повторите попытку.'
const stored = <T,>(key: string): T | null => {
  try {
    const value = sessionStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}
const save = (key: string, value: unknown) => {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Server state remains authoritative when browser storage is unavailable. */
  }
}

function Items({
  data,
  editable = false,
}: {
  data: Pick<Cart, 'items' | 'currency'>
  editable?: boolean
}) {
  const { controller, busy } = useShopping()
  const intents = useRef(
    new Map<string, { fingerprint: string; input: CartAction }>(),
  )
  function change(
    productId: string,
    action: 'set' | 'remove',
    quantity?: number,
  ) {
    const fingerprint = JSON.stringify({ action, quantity })
    let intent = intents.current.get(productId)
    if (intent?.fingerprint !== fingerprint) {
      const input: CartAction =
        action === 'remove'
          ? { action, productId, operationId: crypto.randomUUID() }
          : {
              action,
              productId,
              quantity: quantity!,
              operationId: crypto.randomUUID(),
            }
      intent = { fingerprint, input }
      intents.current.set(productId, intent)
    }
    void controller.change(intent.input).then(
      () => intents.current.delete(productId),
      () => {},
    )
  }
  return (
    <ul className="divide-y">
      {data.items.map((line) => (
        <li
          key={line.productId}
          className="flex gap-4 py-5"
          aria-busy={editable && busy[line.productId]}
        >
          <ProductImage
            product={{
              images: line.image
                ? [
                    {
                      id: line.productId,
                      url: line.image,
                      alt: line.name,
                      position: 0,
                    },
                  ]
                : [],
              category: {
                id: line.category,
                slug: line.category,
                name: '',
                description: '',
                position: 0,
              },
              color: { slug: '', name: '', hex: line.color },
              type: { slug: line.type, name: '' },
            }}
            className="aspect-square size-20 shrink-0 sm:size-24"
          />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl sm:text-2xl">{line.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {money(line.unitPriceMinor, data.currency)} за штуку
            </p>
            {!line.available && editable && (
              <p className="mt-2 text-xs text-destructive">
                Сейчас недоступен. Уберите из корзины.
              </p>
            )}
            {editable ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex h-9 items-center border">
                  <button
                    className="px-2 py-2 disabled:opacity-30"
                    aria-label={`Уменьшить количество: ${line.name}`}
                    disabled={busy[line.productId] || line.quantity <= 1}
                    onClick={() =>
                      change(line.productId, 'set', line.quantity - 1)
                    }
                  >
                    <Minus className="size-3" />
                  </button>
                  <span
                    className="flex w-8 justify-center text-xs"
                    aria-live="polite"
                  >
                    {busy[line.productId] ? (
                      <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
                    ) : (
                      line.quantity
                    )}
                  </span>
                  <button
                    className="px-2 py-2 disabled:opacity-30"
                    aria-label={`Увеличить количество: ${line.name}`}
                    disabled={
                      busy[line.productId] ||
                      line.quantity >= 99 ||
                      !line.available
                    }
                    onClick={() =>
                      change(line.productId, 'set', line.quantity + 1)
                    }
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Удалить: ${line.name}`}
                  disabled={busy[line.productId]}
                  onClick={() => change(line.productId, 'remove')}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs">Количество: {line.quantity}</p>
            )}
          </div>
          <p className="shrink-0 pt-1 text-sm">
            {money(line.lineTotalMinor, data.currency)}
          </p>
        </li>
      ))}
    </ul>
  )
}
function Total({
  data,
}: {
  data: Pick<Cart, 'totalMinor' | 'currency' | 'items'>
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-t pt-5">
      <div>
        <p className="text-xs text-muted-foreground">
          {productCount(data.items.reduce((n, item) => n + item.quantity, 0))}
        </p>
        <p className="mt-1 text-sm">Итого</p>
      </div>
      <strong className="text-2xl font-normal">
        {money(data.totalMinor, data.currency)}
      </strong>
    </div>
  )
}
function ContactSummary({ customer }: { customer: Customer }) {
  return (
    <div className="border-y py-5 text-sm">
      <p className="eyebrow mb-3">Контактные данные</p>
      <p>{customer.name}</p>
      <p className="mt-1 break-all text-muted-foreground">{customer.email}</p>
    </div>
  )
}
function CheckoutContent({
  target,
  navigate,
  continueShopping,
}: {
  target: ShoppingTarget
  navigate: (target: ShoppingTarget) => void
  continueShopping: () => void
}) {
  const {
    controller,
    cart,
    loading,
    error: cartError,
    busy: cartBusy,
  } = useShopping()
  const client = controller.client
  const [customer, setCustomer] = useState<Customer>(
    () =>
      target.quote?.customer ??
      stored<Customer>(`tiho.contacts.${cart?.id}`) ?? { name: '', email: '' },
  )
  const [fields, setFields] = useState<Partial<Customer>>({})
  const [quote, setQuote] = useState<Quote | null>(target.quote ?? null)
  const [order, setOrder] = useState<Order | null>(null)
  const acceptOrder = useCallback(
    (next: Order) =>
      setOrder((previous) => {
        if (!previous || previous.id !== next.id) return next
        if (previous.paymentStatus === 'completed') return previous
        if (previous.attempt && !next.attempt) return previous
        if (previous.attempt && next.attempt) {
          if (previous.attempt.createdAt > next.attempt.createdAt)
            return previous
          const rank = { pending: 0, processing: 1, failed: 2, succeeded: 3 }
          if (
            previous.attempt.id === next.attempt.id &&
            rank[previous.attempt.status] > rank[next.attempt.status]
          )
            return previous
        }
        return next
      }),
    [],
  )
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [recovering, setRecovering] = useState(
    () =>
      target.screen === 'checkout' && !!stored(`tiho.order-intent.${cart?.id}`),
  )
  const title = useRef<HTMLHeadingElement>(null)
  const orderId = target.orderId ?? target.order?.id
  const contactKey = `tiho.contacts.${cart?.id ?? 'pending'}`
  const orderIntentKey = `tiho.order-intent.${cart?.id ?? 'pending'}`
  const paymentKey = `tiho.payment-intent.${orderId ?? 'pending'}`

  useEffect(() => {
    title.current?.focus()
  }, [target.screen, orderId, quote?.id])
  useEffect(() => {
    let active = true
    if (orderId) {
      void client.order(orderId).then(
        (value) => {
          if (active) {
            acceptOrder(value)
            setError(null)
          }
        },
        (e: unknown) => {
          if (active) setError(message(e))
        },
      )
    } else if (target.screen === 'orders') {
      void client.orders().then(
        (value) => {
          if (active) {
            setOrders(value.items)
            setError(null)
          }
        },
        (e: unknown) => {
          if (active) setError(message(e))
        },
      )
    }
    return () => {
      active = false
    }
  }, [client, orderId, target.screen, loadAttempt, acceptOrder])
  // Resume the exact submitted intention after a reload or a lost create response.
  useEffect(() => {
    if (!cart || target.screen !== 'checkout') return
    const intent = stored<{ quoteId: string; operationId: string }>(
      orderIntentKey,
    )
    if (!intent) return
    let active = true
    locked.current = true
    void client
      .create(intent.quoteId, intent.operationId)
      .then(
        (created) => {
          if (!active) return
          save(orderIntentKey, null)
          void controller.refresh()
          navigate({ screen: 'payment', orderId: created.id })
        },
        (e: unknown) => {
          if (!active) return
          if (
            e instanceof ShoppingError &&
            ['CART_CHANGED', 'QUOTE_EXPIRED'].includes(e.code)
          )
            save(orderIntentKey, null)
          setError(message(e))
        },
      )
      .finally(() => {
        if (active) {
          setRecovering(false)
          locked.current = false
        }
      })
    return () => {
      active = false
    }
    // The saved intention is checked once per entry, not after cart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id, target.screen, orderIntentKey, loadAttempt])
  const processingId =
    order?.paymentStatus !== 'completed' ? order?.id : undefined
  const pollingDelay = order?.paymentStatus === 'processing' ? 1000 : 5000
  useEffect(() => {
    if (!processingId) return
    let active = true
    const poll = async () => {
      try {
        const current = await client.order(processingId)
        if (!active) return
        acceptOrder(current)
        setError(null)
        if (
          current.paymentStatus === 'completed' ||
          current.paymentStatus === 'failed'
        )
          save(paymentKey, null)
      } catch (e) {
        if (active) setError(message(e))
      }
    }
    const stop = pollWhileVisible(poll, pollingDelay)
    return () => {
      active = false
      stop()
    }
  }, [client, processingId, paymentKey, acceptOrder, pollingDelay])

  useEffect(() => {
    controller.context({
      quote,
      quoteId: quote?.id,
      order,
      orderId: order?.id,
      screen: target.screen,
    })
  }, [controller, quote, order, target.screen])

  async function task(action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(message(e))
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  function updateCustomer(key: keyof Customer, value: string) {
    const next = { ...customer, [key]: value }
    setCustomer(next)
    save(contactKey, next)
    setFields((old) => ({ ...old, [key]: undefined }))
  }
  async function prepare() {
    const errors: Partial<Customer> = {}
    if (customer.name.trim().length < 2)
      errors.name = 'Укажите имя получателя, не менее двух букв.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()))
      errors.email = 'Укажите email в формате name@example.com.'
    setFields(errors)
    if (Object.keys(errors).length || !cart) return
    await task(async () => {
      try {
        setQuote(
          await client.prepare(cart.version, {
            name: customer.name.trim(),
            email: customer.email.trim(),
          }),
        )
      } catch (e) {
        await controller.refresh()
        throw e
      }
    })
  }
  async function create() {
    if (!quote) return
    await task(async () => {
      let intent = stored<{ quoteId: string; operationId: string }>(
        orderIntentKey,
      )
      if (!intent || intent.quoteId !== quote.id) {
        intent = { quoteId: quote.id, operationId: crypto.randomUUID() }
        save(orderIntentKey, intent)
      }
      try {
        const created = await client.create(intent.quoteId, intent.operationId)
        save(orderIntentKey, null)
        await controller.refresh()
        navigate({ screen: 'payment', orderId: created.id })
      } catch (e) {
        if (
          e instanceof ShoppingError &&
          ['CART_CHANGED', 'QUOTE_EXPIRED', 'UNAVAILABLE'].includes(e.code)
        ) {
          setQuote(null)
          save(orderIntentKey, null)
          await controller.refresh()
        }
        throw e
      }
    })
  }
  async function pay() {
    if (!orderId) return
    await task(async () => {
      const current = await client.order(orderId)
      acceptOrder(current)
      if (
        current.paymentStatus === 'completed' ||
        current.paymentStatus === 'processing'
      )
        return
      if (current.paymentStatus === 'failed') save(paymentKey, null)
      let operationId = stored<string>(paymentKey)
      if (!operationId) {
        operationId = crypto.randomUUID()
        save(paymentKey, operationId)
      }
      await client.pay(orderId, operationId)
      const result = await client.order(orderId)
      acceptOrder(result)
      if (
        result.paymentStatus === 'failed' ||
        result.paymentStatus === 'completed'
      )
        save(paymentKey, null)
    })
  }
  const completed = order?.paymentStatus === 'completed'
  const heading =
    target.screen === 'cart'
      ? 'Корзина'
      : target.screen === 'orders'
        ? 'Мои заказы'
        : completed
          ? `Заказ №${order.number} оформлен`
          : target.screen === 'payment'
            ? 'Оплата заказа'
            : target.screen === 'order'
              ? `Заказ №${order?.number ?? '…'}`
              : quote
                ? 'Проверка заказа'
                : 'Контактные данные'
  return (
    <section
      className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12"
      aria-label="Покупки TIHO"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={
            target.screen === 'cart'
              ? continueShopping
              : () => {
                  if (quote && target.screen === 'checkout') setQuote(null)
                  else navigate({ screen: 'cart' })
                }
          }
        >
          <ArrowLeft className="size-4" />
          {target.screen === 'cart'
            ? 'Продолжить покупки'
            : quote && target.screen === 'checkout'
              ? 'Контактные данные'
              : 'Корзина'}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ screen: 'orders' })}>
          Мои заказы
        </Button>
      </div>
      {target.screen === 'checkout' && (
        <ol
          className="mb-6 flex flex-wrap gap-4 text-xs text-muted-foreground"
          aria-label="Этапы оформления"
        >
          <li>1. Корзина</li>
          <li className={!quote ? 'text-foreground' : ''}>
            2. Контактные данные
          </li>
          <li className={quote ? 'text-foreground' : ''}>3. Проверка заказа</li>
        </ol>
      )}
      {completed && (
        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-7" />
        </div>
      )}
      {recovering && (
        <p role="status" className="mb-4 text-sm">
          Восстанавливаем сохранённый заказ…
        </p>
      )}
      <h1
        ref={title}
        tabIndex={-1}
        className="font-serif text-4xl leading-tight outline-none sm:text-5xl"
      >
        {heading}
      </h1>
      {(error ||
        (['cart', 'checkout'].includes(target.screen) && cartError)) && (
        <div
          role="alert"
          className="my-6 border border-destructive/40 bg-card p-4 text-sm"
        >
          <p>{error ?? cartError}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              setLoadAttempt((n) => n + 1)
              void controller.refresh()
            }}
          >
            Обновить данные
          </Button>
        </div>
      )}
      {((loading && !cart) ||
        (orderId && (!order || order.id !== orderId) && !error) ||
        (target.screen === 'orders' && !orders && !error)) && (
        <div
          className="mt-8 space-y-4"
          role="status"
          aria-label="Загружаем данные"
        >
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="ml-auto h-12 w-48" />
        </div>
      )}
      {target.screen === 'cart' &&
        cart &&
        (cart.items.length ? (
          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_260px]">
            <div>
              {cart.changes.map((change) => (
                <p key={change} role="status" className="mb-2 text-sm">
                  {change}
                </p>
              ))}
              <Items data={cart} editable />
              <Button
                variant="ghost"
                disabled={Object.values(cartBusy).some(Boolean)}
                onClick={() => {
                  const key = `tiho.clear.${cart.id}.${cart.version}`
                  const operationId = stored<string>(key) ?? crypto.randomUUID()
                  save(key, operationId)
                  void controller.change({ action: 'clear', operationId }).then(
                    () => save(key, null),
                    () => {},
                  )
                }}
              >
                Очистить корзину
              </Button>
            </div>
            <aside className="h-fit border bg-card p-5">
              <Total data={cart} />
              <Button
                className="mt-6 w-full"
                disabled={
                  Object.values(cartBusy).some(Boolean) ||
                  cart.items.some((line) => !line.available)
                }
                onClick={() => navigate({ screen: 'checkout' })}
              >
                Перейти к оформлению
              </Button>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                На следующем шаге проверим состав и контактные данные.
              </p>
            </aside>
          </div>
        ) : (
          <div className="mt-10 border bg-card px-6 py-14 text-center">
            <ShoppingBag
              className="mx-auto mb-5 size-10 text-primary/60"
              strokeWidth={1}
            />
            <h2 className="font-serif text-3xl">Здесь пока тихо</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Добавьте предметы, которые хочется забрать домой.
            </p>
            <Button className="mt-7" onClick={continueShopping}>
              Продолжить покупки
            </Button>
          </div>
        ))}
      {target.screen === 'checkout' && cart && !quote && (
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]">
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void prepare()
            }}
            className="space-y-6"
          >
            <div>
              <label htmlFor="recipient" className="mb-2 block text-sm">
                Имя получателя
              </label>
              <Input
                id="recipient"
                autoComplete="name"
                maxLength={100}
                value={customer.name}
                aria-invalid={!!fields.name}
                aria-describedby={fields.name ? 'recipient-error' : undefined}
                onChange={(e) => updateCustomer('name', e.target.value)}
              />
              {fields.name && (
                <p
                  id="recipient-error"
                  role="alert"
                  className="mt-2 text-xs text-destructive"
                >
                  {fields.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={customer.email}
                aria-invalid={!!fields.email}
                aria-describedby={fields.email ? 'email-error' : undefined}
                onChange={(e) => updateCustomer('email', e.target.value)}
              />
              {fields.email && (
                <p
                  id="email-error"
                  role="alert"
                  className="mt-2 text-xs text-destructive"
                >
                  {fields.email}
                </p>
              )}
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              Сохраним эти данные в заказе. Проверить его можно в разделе «Мои
              заказы».
            </p>
            <Button
              type="submit"
              disabled={recovering || busy || !cart.items.length}
            >
              {busy ? 'Готовим сводку…' : 'Проверить заказ'}
            </Button>
          </form>
          <aside className="h-fit border bg-card p-5">
            <Items data={cart} />
            <Total data={cart} />
          </aside>
        </div>
      )}
      {target.screen === 'checkout' && quote && (
        <div className="mt-8">
          <ContactSummary customer={quote.customer} />
          <Items data={quote.cart} />
          <Total data={quote.cart} />
          {cart && cart.version !== quote.cart.version && (
            <p role="alert" className="mt-5 text-sm text-destructive">
              Корзина изменилась. Вернитесь к контактным данным и проверьте
              новую сводку.
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              disabled={recovering || busy}
              onClick={() => setQuote(null)}
            >
              Изменить данные
            </Button>
            <Button
              disabled={
                recovering || busy || cart?.version !== quote.cart.version
              }
              onClick={() => void create()}
            >
              {busy ? 'Оформляем заказ…' : 'Оформить заказ'}
            </Button>
          </div>
        </div>
      )}
      {order && order.id === orderId && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString('ru-RU', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </p>
          {completed && (
            <p role="status" className="mt-3 text-sm">
              Заказ сохранён. Его состав и итог доступны в любой момент.
            </p>
          )}
          {target.screen === 'payment' && !completed && (
            <div className="my-8 border bg-card p-6 sm:p-8">
              <p className="eyebrow">Заказ №{order.number}</p>
              <p className="mt-4 font-serif text-4xl">
                {money(order.totalMinor, order.currency)}
              </p>
              {order.paymentStatus === 'processing' ? (
                <div role="status" className="mt-6 flex items-center gap-3">
                  <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />
                  Обрабатываем платёж
                  <p className="sr-only">Статус сохраняется на сервере.</p>
                </div>
              ) : (
                <>
                  {order.paymentStatus === 'failed' && (
                    <p role="alert" className="mt-5 text-sm text-destructive">
                      Не удалось завершить оплату
                    </p>
                  )}
                  <Button
                    className="mt-6"
                    disabled={recovering || busy}
                    onClick={() => void pay()}
                  >
                    {busy
                      ? 'Начинаем оплату…'
                      : order.paymentStatus === 'failed'
                        ? 'Попробовать ещё раз'
                        : `Оплатить ${money(order.totalMinor, order.currency)}`}
                  </Button>
                </>
              )}
            </div>
          )}
          <div className="mt-8">
            <ContactSummary customer={order.customer} />
            <Items data={order} />
            <Total data={order} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {completed && target.screen === 'payment' && (
              <Button
                onClick={() => navigate({ screen: 'order', orderId: order.id })}
              >
                Посмотреть заказ
              </Button>
            )}
            {target.screen === 'order' && !completed && (
              <Button
                onClick={() =>
                  navigate({ screen: 'payment', orderId: order.id })
                }
              >
                Перейти к оплате
              </Button>
            )}
            <Button variant="outline" onClick={continueShopping}>
              Продолжить покупки
            </Button>
          </div>
        </div>
      )}
      {target.screen === 'orders' && orders && (
        <div className="mt-8 space-y-4">
          {!orders.length && (
            <p className="py-8 text-sm text-muted-foreground">
              Здесь появятся ваши сохранённые заказы.
            </p>
          )}
          {orders.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center justify-between gap-5 border bg-card p-5 text-left hover:bg-accent"
              onClick={() => navigate({ screen: 'order', orderId: item.id })}
            >
              <span>
                <span className="font-serif text-xl">№{item.number}</span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString('ru-RU')} ·{' '}
                  {item.paymentStatus === 'completed'
                    ? 'Оформлен'
                    : item.paymentStatus === 'processing'
                      ? 'Обрабатываем платёж'
                      : item.paymentStatus === 'failed'
                        ? 'Ожидает повторной оплаты'
                        : 'Ожидает оплаты'}
                </span>
              </span>
              <span className="shrink-0 text-sm">
                {money(item.totalMinor, item.currency)}
              </span>
            </button>
          ))}
        </div>
      )}
      {client.openStore && (
        <Button
          className="mt-10"
          variant="ghost"
          onClick={() =>
            void task(() =>
              client.openStore!(orderId ? `/orders/${orderId}` : '/cart'),
            )
          }
        >
          Продолжить на сайте <ArrowUpRight className="size-4" />
        </Button>
      )}
    </section>
  )
}

export function CheckoutFlow(props: {
  target: ShoppingTarget
  navigate: (target: ShoppingTarget) => void
  continueShopping: () => void
}) {
  const { cart, error, controller } = useShopping()
  if (!cart)
    return (
      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-serif text-4xl">Ваши покупки</h1>
        {error ? (
          <div role="alert" className="mt-6">
            <p>{error}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void controller.refresh()}
            >
              Обновить данные
            </Button>
          </div>
        ) : (
          <div
            role="status"
            aria-label="Загружаем покупки"
            className="mt-8 space-y-4"
          >
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}
      </section>
    )
  return <CheckoutContent key={cart.id} {...props} />
}
