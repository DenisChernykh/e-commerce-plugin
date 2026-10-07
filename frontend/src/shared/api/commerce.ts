import type {
  Cart,
  CartAction,
  Customer,
  Quote,
  Order,
  Attempt,
} from '../../../../backend/src/modules/commerce/public-contracts'
import type { CatalogBridge, ToolResult } from './catalog-mcp'
export type { Cart, CartAction, Customer, Quote, Order, Attempt }
export type ShoppingScreen =
  'cart' | 'checkout' | 'payment' | 'order' | 'orders'
export type ShoppingTarget = {
  screen: ShoppingScreen
  orderId?: string
  order?: Order
  quote?: Quote
}
export class ShoppingError extends Error {
  constructor(
    message: string,
    public code = 'NETWORK_ERROR',
  ) {
    super(message)
  }
}
export interface ShoppingClient {
  cart(): Promise<Cart>
  change(input: CartAction): Promise<Cart>
  prepare(cartVersion: number, customer: Customer): Promise<Quote>
  quote(id: string): Promise<Quote>
  create(quoteId: string, operationId: string): Promise<Order>
  order(id: string): Promise<Order>
  orders(): Promise<{ items: Order[] }>
  pay(orderId: string, operationId: string): Promise<Attempt>
  attempt(id: string): Promise<Attempt>
  openStore?(target: string): Promise<void>
}
export async function shoppingRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/commerce${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new ShoppingError(
      'Ответ магазина не получен. Проверьте подключение. Ваши данные сохранены; перед повтором мы проверим результат.',
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data)
    throw new ShoppingError(
      response.status >= 500
        ? 'Магазин временно недоступен. Попробуйте ещё раз.'
        : (data?.detail ?? 'Не удалось выполнить действие.'),
      data?.code,
    )
  return data as T
}
export function createHttpShoppingClient(): ShoppingClient {
  let session: Promise<unknown> | undefined
  const ready = () =>
    (session ??= shoppingRequest('/session', {}).catch((error) => {
      session = undefined
      throw error
    }))
  const request = async <T>(path: string, body?: unknown) => {
    await ready()
    return shoppingRequest<T>(path, body)
  }
  return {
    cart: () => request('/cart'),
    change: (input) => request('/cart', input),
    prepare: (cartVersion, customer) =>
      request('/checkout', { cartVersion, customer }),
    quote: (id) => request(`/checkout/${id}`),
    create: (quoteId, operationId) =>
      request('/orders', { quoteId, operationId }),
    order: (id) => request(`/orders/${id}`),
    orders: () => request('/orders'),
    pay: (id, operationId) => request(`/orders/${id}/payment`, { operationId }),
    attempt: (id) => request(`/payments/${id}`),
  }
}
export function createMcpShoppingClient(bridge: CatalogBridge): ShoppingClient {
  const call = async <T>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    let result: ToolResult
    try {
      result = await bridge.callTool(name, args)
    } catch {
      throw new ShoppingError(
        'Не удалось получить ответ. Проверьте состояние перед повтором.',
      )
    }
    if (result.isError) {
      const error = result.structuredContent?.error as
        { code?: string; message?: string } | undefined
      throw new ShoppingError(
        error?.message ??
          result.content?.[0]?.text ??
          'Не удалось выполнить действие.',
        error?.code,
      )
    }
    return result.structuredContent?.data as T
  }
  return {
    cart: () => call('get_cart'),
    change: (input) => call('update_cart', input),
    prepare: (cartVersion, customer) =>
      call('prepare_checkout', { cartVersion, customer }),
    quote: async (id) =>
      (
        await call<{ quote: Quote }>('open_checkout', {
          view: 'checkout',
          quoteId: id,
        })
      ).quote,
    create: (quoteId, operationId) =>
      call('create_order', { quoteId, operationId }),
    order: (orderId) => call('get_order', { orderId }),
    orders: () => call('list_orders'),
    pay: (orderId, operationId) =>
      call('start_payment', { orderId, operationId }),
    attempt: (attemptId) => call('get_payment', { attemptId }),
    openStore: async (target) => {
      const result = await bridge.callTool('store_link', { target })
      const url = result._meta?.storeLink
      if (result.isError || typeof url !== 'string')
        throw new ShoppingError(
          'Не удалось открыть магазин. Повторите переход.',
        )
      await bridge.openLink(url)
    },
  }
}
