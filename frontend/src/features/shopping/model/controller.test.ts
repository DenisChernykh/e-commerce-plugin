import { describe, expect, it, vi } from 'vitest'
import type { Cart, ShoppingClient } from '@/shared/api'
import { createShoppingController } from './controller'

const cart = (version: number): Cart => ({
  id: 'cart-a',
  version,
  currency: 'RUB',
  items: [],
  totalMinor: version * 100,
  itemCount: 0,
  changes: [],
})
function setup() {
  const client: ShoppingClient = {
    cart: vi.fn(),
    change: vi.fn(),
    prepare: vi.fn(),
    quote: vi.fn(),
    create: vi.fn(),
    order: vi.fn(),
    orders: vi.fn(),
    pay: vi.fn(),
    attempt: vi.fn(),
  }
  const publish = vi.fn().mockResolvedValue(undefined)
  return {
    client,
    publish,
    controller: createShoppingController(client, publish),
  }
}
describe('shopping concurrency and model context', () => {
  it('does not repeatedly publish an unchanged cart into the conversation', async () => {
    const { controller, publish } = setup()
    controller.accept(cart(3))
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    controller.accept(cart(3))
    controller.accept(cart(3))
    await Promise.resolve()
    expect(publish).toHaveBeenCalledTimes(1)
    controller.accept(cart(4))
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
  })
  it('does not replace a newer mutation with an older polling response', async () => {
    const { client, controller } = setup()
    let resolveRead!: (value: Cart) => void
    vi.mocked(client.cart).mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve
      }),
    )
    const reading = controller.refresh()
    vi.mocked(client.change).mockResolvedValue(cart(4))
    await controller.change({
      action: 'clear',
      operationId: crypto.randomUUID(),
    })
    resolveRead(cart(3))
    await reading
    expect(controller.getSnapshot().cart?.version).toBe(4)
  })
  it('suppresses a duplicate click while allowing a later new action', async () => {
    const { client, controller } = setup()
    let resolveChange!: (value: Cart) => void
    vi.mocked(client.change).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveChange = resolve
      }),
    )
    const intent = {
      action: 'clear' as const,
      operationId: crypto.randomUUID(),
    }
    const first = controller.change(intent)
    await controller.change(intent)
    expect(client.change).toHaveBeenCalledTimes(1)
    resolveChange(cart(1))
    await first
    vi.mocked(client.change).mockResolvedValue(cart(2))
    await controller.change({ ...intent, operationId: crypto.randomUUID() })
    expect(client.change).toHaveBeenCalledTimes(2)
  })
  it('retains server data and releases the button after a network failure', async () => {
    const { client, controller } = setup()
    controller.accept(cart(2))
    vi.mocked(client.change).mockRejectedValue(new Error('Соединение прервано'))
    await expect(
      controller.change({ action: 'clear', operationId: crypto.randomUUID() }),
    ).rejects.toThrow()
    expect(controller.getSnapshot()).toMatchObject({
      cart: cart(2),
      busy: { clear: false },
      error: 'Соединение прервано',
    })
  })
  it('publishes the actual quote context and clears it on leaving checkout', async () => {
    const { client, controller, publish } = setup()
    vi.mocked(client.cart).mockResolvedValue(cart(2))
    controller.accept(cart(2))
    controller.context({ screen: 'checkout', quoteId: 'quote-a' })
    await vi.waitFor(() =>
      expect(publish).toHaveBeenLastCalledWith({
        shopping: expect.objectContaining({
          cart: cart(2),
          quoteId: 'quote-a',
          screen: 'checkout',
        }),
      }),
    )
    controller.open(null)
    await vi.waitFor(() =>
      expect(publish).toHaveBeenLastCalledWith({
        shopping: expect.objectContaining({
          quoteId: undefined,
          screen: 'catalog',
        }),
      }),
    )
  })
})
