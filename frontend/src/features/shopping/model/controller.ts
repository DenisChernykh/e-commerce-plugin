import {
  type Cart,
  type CartAction,
  type ShoppingClient,
  type ShoppingTarget,
} from '@/shared/api'
export type ShoppingState = {
  cart: Cart | null
  loading: boolean
  error: string | null
  target: ShoppingTarget | null
  busy: Record<string, boolean>
}
export function createShoppingController(
  client: ShoppingClient,
  publish?: (context: Record<string, unknown>) => Promise<unknown>,
) {
  let state: ShoppingState = {
    cart: null,
    loading: true,
    error: null,
    target: null,
    busy: {},
  }
  const listeners = new Set<() => void>()
  let refreshSequence = 0
  const emit = (patch: Partial<ShoppingState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  let contextQueue: Promise<unknown> = Promise.resolve()
  let publishedContext = ''
  let checkoutContext: Record<string, unknown> = {}
  function sync() {
    const shopping = {
      cart: state.cart,
      screen: state.target?.screen ?? 'catalog',
      orderId: state.target?.orderId ?? state.target?.order?.id,
      quoteId: state.target?.quote?.id,
      ...checkoutContext,
    }
    const signature = JSON.stringify(shopping)
    if (publish && signature !== publishedContext) {
      publishedContext = signature
      contextQueue = contextQueue
        .catch(() => {})
        .then(() => publish({ shopping }))
        .catch(() => {
          if (publishedContext !== signature) return
          publishedContext = ''
          emit({
            error:
              'Не удалось передать корзину в разговор. Обновите данные перед следующей командой.',
          })
        })
    }
  }
  function accept(cart: Cart) {
    if (state.cart?.id === cart.id && state.cart.version > cart.version) return
    if (
      JSON.stringify(state.cart) !== JSON.stringify(cart) ||
      state.error ||
      state.loading
    )
      emit({ cart, error: null, loading: false })
    sync()
  }
  async function refresh() {
    const sequence = ++refreshSequence
    try {
      const cart = await client.cart()
      if (sequence === refreshSequence) accept(cart)
    } catch (error) {
      if (sequence === refreshSequence)
        emit({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить корзину.',
        })
    }
  }
  return {
    client,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    refresh,
    accept,
    context(details: Record<string, unknown>) {
      checkoutContext = details
      sync()
    },
    open(target: ShoppingTarget | null) {
      checkoutContext = {}
      emit({ target })
      sync()
      void refresh()
    },
    receive(data: {
      cart?: Cart
      screen?: ShoppingTarget['screen']
      order?: ShoppingTarget['order']
      quote?: ShoppingTarget['quote']
    }) {
      if (data.cart) accept(data.cart)
      if (data.screen) {
        checkoutContext = {}
        emit({
          target: {
            screen: data.screen,
            order: data.order,
            orderId: data.order?.id,
            quote: data.quote,
          },
        })
        sync()
      }
    },
    async change(input: CartAction) {
      const key = 'productId' in input ? input.productId : 'clear'
      if (state.busy[key]) return
      emit({ busy: { ...state.busy, [key]: true }, error: null })
      try {
        accept(await client.change(input))
      } catch (error) {
        emit({
          error:
            error instanceof Error
              ? error.message
              : 'Не удалось изменить корзину.',
        })
        throw error
      } finally {
        emit({ busy: { ...state.busy, [key]: false } })
      }
    },
  }
}
export type ShoppingController = ReturnType<typeof createShoppingController>
