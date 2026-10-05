import { describe, expect, it, vi } from 'vitest'
import type {
  CatalogBridge,
  CatalogResult,
  ProductResult,
  ToolResult,
} from '@/shared/api'
import { createCatalogController } from './controller'

function catalog(category = 'candles', page = 1): CatalogResult {
  return {
    view: 'catalog',
    items: [],
    returned: 0,
    selection: {
      id: crypto.randomUUID(),
      params: {
        category,
        color: 'beige',
        priceTo: 3000,
        sort: 'price_asc',
        page,
        pageSize: 3,
      },
      productIds: [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
      ],
    },
    pagination: { page, pageSize: 3, total: 6, totalPages: 2 },
    next: null,
    catalogUrl: 'https://tiho-store.vercel.app/catalog',
    fetchedAt: new Date().toISOString(),
    requestId: null,
  }
}
const tool = (data: unknown): ToolResult => ({ structuredContent: { data } })
function setup() {
  const bridge: CatalogBridge = {
    callTool: vi.fn(),
    publishContext: vi.fn().mockResolvedValue({}),
    openLink: vi.fn().mockResolvedValue({}),
  }
  return { bridge, controller: createCatalogController(bridge) }
}
describe('catalog UI state and model context', () => {
  it('restores history supplied by a server visual result after a fresh mount', async () => {
    const { bridge, controller } = setup()
    const first = catalog()
    const second = catalog('textiles')
    controller.receive(
      tool({ ...second, previousSelections: [first.selection] }),
    )
    expect(controller.getSnapshot().previousSelections).toEqual([
      first.selection,
    ])
    vi.mocked(bridge.callTool).mockResolvedValue(tool(first))
    await controller.back()
    expect(bridge.callTool).toHaveBeenCalledWith(
      'search_products',
      expect.objectContaining({ base: first.selection.params }),
    )
    expect(controller.getSnapshot().catalog).toEqual(first)
    expect(controller.getSnapshot().history).toEqual([])
    expect(controller.getSnapshot().previousSelections).toEqual([])
  })
  it('returns from a freshly opened product to its list before earlier history', async () => {
    const { bridge, controller } = setup()
    const prior = catalog('ceramics')
    const list = catalog()
    controller.receive(
      tool({
        view: 'product',
        product: { id: list.selection.productIds[1] },
        selection: list.selection,
        previousSelections: [prior.selection],
      }),
    )
    vi.mocked(bridge.callTool).mockResolvedValue(tool(list))
    await controller.back()
    expect(controller.getSnapshot().catalog).toEqual(list)
    expect(controller.getSnapshot().previousSelections).toEqual([
      prior.selection,
    ])
  })
  it('retains history on failed restoration and consumes it only after successful retry', async () => {
    const { bridge, controller } = setup()
    const prior = catalog()
    const current = catalog('textiles')
    controller.receive(
      tool({ ...current, previousSelections: [prior.selection] }),
    )
    vi.mocked(bridge.callTool)
      .mockResolvedValueOnce({
        isError: true,
        content: [{ type: 'text', text: 'Unavailable' }],
      })
      .mockResolvedValueOnce(tool(prior))
    await controller.back()
    expect(controller.getSnapshot().previousSelections).toEqual([
      prior.selection,
    ])
    expect(controller.getSnapshot().catalog?.selection).toEqual(
      current.selection,
    )
    await controller.retry()
    expect(controller.getSnapshot().previousSelections).toEqual([])
    expect(controller.getSnapshot().catalog).toEqual(prior)
  })
  it('composes rapid filter changes while a previous request is pending', async () => {
    const { bridge, controller } = setup()
    controller.receive(tool(catalog()))
    let resolveOld!: (value: ToolResult) => void
    vi.mocked(bridge.callTool).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    vi.mocked(bridge.callTool).mockResolvedValueOnce(tool(catalog('ceramics')))
    const old = controller.search({ category: 'ceramics' })
    await controller.search({ availability: 'in_stock' })
    expect(bridge.callTool).toHaveBeenLastCalledWith(
      'search_products',
      expect.objectContaining({
        changes: { category: 'ceramics', availability: 'in_stock' },
      }),
    )
    resolveOld(tool(catalog()))
    await old
  })
  it('ignores a late host result after a newer manual interaction', async () => {
    const { bridge, controller } = setup()
    controller.receive(tool(catalog()))
    controller.beginHostRequest()
    const newest = catalog('textiles')
    vi.mocked(bridge.callTool).mockResolvedValue(tool(newest))
    await controller.search({ category: 'textiles' })
    controller.receive(tool(catalog('ceramics')))
    expect(controller.getSnapshot().catalog).toEqual(newest)
  })
  it('sends only the changed field with the complete current base', async () => {
    const { bridge, controller } = setup()
    const first = catalog()
    controller.receive(tool(first))
    vi.mocked(bridge.callTool).mockResolvedValue(tool(catalog()))
    await controller.search({ availability: 'in_stock' })
    expect(bridge.callTool).toHaveBeenCalledWith(
      'search_products',
      expect.objectContaining({
        base: first.selection.params,
        changes: { availability: 'in_stock' },
      }),
    )
    await controller.search({ color: null })
    expect(bridge.callTool).toHaveBeenLastCalledWith(
      'search_products',
      expect.objectContaining({ changes: { color: null } }),
    )
  })
  it('passes exact ordered selection for an ordinal and publishes manual choices', async () => {
    const { bridge, controller } = setup()
    const first = catalog()
    controller.receive(tool(first))
    controller.select(first.selection.productIds[0]!)
    vi.mocked(bridge.callTool).mockResolvedValue(
      tool({
        view: 'product',
        product: { id: first.selection.productIds[1] },
        selection: first.selection,
        fetchedAt: first.fetchedAt,
        requestId: null,
      } as ProductResult),
    )
    await controller.open(2)
    expect(bridge.callTool).toHaveBeenCalledWith(
      'get_product',
      expect.objectContaining({ selection: first.selection, position: 2 }),
    )
    await vi.waitFor(() =>
      expect(bridge.publishContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selection: first.selection,
          productId: first.selection.productIds[1],
        }),
      ),
    )
    controller.back()
    expect(controller.getSnapshot().data).toEqual(first)
  })
  it('restores the exact previous result snapshot without losing filters or ordered IDs', async () => {
    const { bridge, controller } = setup()
    const first = catalog()
    controller.receive(tool(first))
    const second = catalog('ceramics')
    vi.mocked(bridge.callTool).mockResolvedValue(tool(second))
    await controller.search({ category: 'ceramics' })
    expect(controller.getSnapshot().history).toEqual([first])
    controller.back()
    expect(controller.getSnapshot().catalog).toEqual(first)
    expect(controller.getSnapshot().history).toEqual([])
  })
  it('continues the backend next request without resetting filters', async () => {
    const { bridge, controller } = setup()
    const first = catalog()
    first.next = { base: first.selection.params, changes: { page: 2 } }
    controller.receive(tool(first))
    vi.mocked(bridge.callTool).mockResolvedValue(tool(catalog('candles', 2)))
    await controller.next()
    expect(bridge.callTool).toHaveBeenCalledWith(
      'search_products',
      expect.objectContaining(first.next),
    )
  })
  it('keeps independent UI instances isolated', async () => {
    const left = setup()
    const right = setup()
    const a = catalog()
    const b = catalog('textiles')
    left.controller.receive(tool(a))
    right.controller.receive(tool(b))
    left.controller.select(a.selection.productIds[0]!)
    expect(right.controller.getSnapshot().selectedIds).toEqual([])
    expect(right.controller.getSnapshot().catalog).toEqual(b)
    await vi.waitFor(() =>
      expect(right.bridge.publishContext).toHaveBeenCalled(),
    )
    const l = vi.mocked(left.bridge.publishContext).mock.calls[0]![0]
    const r = vi.mocked(right.bridge.publishContext).mock.calls[0]![0]
    expect(l.uiInstanceId).not.toBe(r.uiInstanceId)
  })
  it('ignores stale search promises and duplicate tool-result notifications', async () => {
    const { bridge, controller } = setup()
    controller.receive(tool(catalog()))
    let resolveOld!: (result: ToolResult) => void
    vi.mocked(bridge.callTool).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    const newer = catalog('textiles')
    vi.mocked(bridge.callTool).mockResolvedValueOnce(tool(newer))
    const pending = controller.search({ color: 'green' })
    await controller.search({ category: 'textiles' })
    const old = catalog('ceramics')
    resolveOld(tool(old))
    await pending
    controller.receive(tool({ ...old, requestId: crypto.randomUUID() }))
    expect(controller.getSnapshot().catalog).toEqual(newer)
  })
  it('keeps the last successful selection visible on error instead of showing empty results', async () => {
    const { bridge, controller } = setup()
    const first = catalog()
    controller.receive(tool(first))
    vi.mocked(bridge.callTool).mockResolvedValue({
      isError: true,
      content: [{ type: 'text', text: 'Backend unavailable' }],
    })
    await controller.search({ color: 'green' })
    expect(controller.getSnapshot().catalog).toEqual(first)
    expect(controller.getSnapshot().error).toBe('Backend unavailable')
    expect(controller.getSnapshot().loading).toBe(false)
  })
})
