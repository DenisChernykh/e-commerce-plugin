import type {
  CatalogBridge,
  CatalogData,
  CatalogResult,
  CatalogSelection,
  CatalogParams,
  ToolResult,
} from '@/shared/api'

export type CatalogState = {
  data: CatalogData | null
  catalog: CatalogResult | null
  history: CatalogResult[]
  previousSelections: CatalogSelection[]
  selectedIds: string[]
  loading: boolean
  error: string | null
  contextError: boolean
}
export function createCatalogController(bridge: CatalogBridge) {
  let state: CatalogState = {
    data: null,
    catalog: null,
    history: [],
    previousSelections: [],
    selectedIds: [],
    loading: true,
    error: null,
    contextError: false,
  }
  const uiInstanceId = crypto.randomUUID()
  const listeners = new Set<() => void>()
  let revision = 0
  let hostRevision = 0
  let pendingSearch: {
    base?: CatalogParams
    changes: Record<string, unknown>
  } | null = null
  type Navigation = { previousSelections: CatalogSelection[] }
  let lastRequest: {
    name: string
    args: Record<string, unknown>
    navigation?: Navigation
  } | null = null
  let contextQueue: Promise<unknown> = Promise.resolve()
  const emit = (patch: Partial<CatalogState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  function sync() {
    const current = state.data
    const context = {
      uiInstanceId,
      visualTool: 'open_store',
      view: current?.view,
      selection: state.catalog?.selection ?? current?.selection ?? null,
      selectedIds: state.selectedIds,
      productId: current?.view === 'product' ? current.product.id : null,
      comparedIds:
        current?.view === 'compare' ? current.products.map((p) => p.id) : [],
      previousSelections: [
        ...state.previousSelections,
        ...state.history.map((entry) => entry.selection),
      ].slice(-8),
    }
    bridge.persist?.(context)
    contextQueue = contextQueue
      .catch(() => {})
      .then(() => bridge.publishContext(context))
      .then(
        () => emit({ contextError: false }),
        () => emit({ contextError: true }),
      )
  }
  function accept(result: ToolResult, navigation?: Navigation) {
    if (result.isError) {
      emit({
        loading: false,
        error:
          result.content?.find((entry) => entry.type === 'text')?.text ??
          'Каталог недоступен. Повторите запрос.',
      })
      return
    }
    const data = result.structuredContent?.data as CatalogData | undefined
    if (!data || !['catalog', 'product', 'compare'].includes(data.view)) return
    const previousSelections =
      navigation?.previousSelections ?? data.previousSelections
    const restored = previousSelections !== undefined
    if (data.view === 'catalog') {
      const previous = state.catalog
      const history = restored
        ? []
        : previous && previous.selection.id !== data.selection.id
          ? [...state.history, previous].slice(-8)
          : state.history
      emit({
        data,
        catalog: data,
        history,
        previousSelections: previousSelections ?? state.previousSelections,
        selectedIds: [],
        loading: false,
        error: null,
      })
    } else
      emit({
        data,
        loading: false,
        error: null,
        ...(restored ? { previousSelections, history: [] } : {}),
      })
    sync()
  }
  async function run(
    name: string,
    args: Record<string, unknown>,
    navigation?: Navigation,
  ) {
    const issued = ++revision
    lastRequest = { name, args, navigation }
    if (name !== 'search_products') pendingSearch = null
    const requestId = crypto.randomUUID()
    emit({ loading: true, error: null })
    try {
      const result = await bridge.callTool(name, { ...args, requestId })
      if (issued === revision) {
        pendingSearch = null
        accept(result, navigation)
        return result
      }
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Подборка уже изменена более новым действием. Получите актуальное состояние.',
          },
        ],
      }
    } catch {
      if (issued === revision) {
        pendingSearch = null
        emit({
          loading: false,
          error:
            'Не удалось получить ответ. Проверьте подключение и повторите.',
        })
      }
      return {
        isError: true,
        content: [
          { type: 'text', text: 'Не удалось получить ответ каталога.' },
        ],
      }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    receive(result: ToolResult) {
      const data = result.structuredContent?.data as CatalogData | undefined
      if (data?.requestId) return
      if (revision !== hostRevision) return
      pendingSearch = null
      accept(result)
    },
    beginHostRequest() {
      hostRevision = ++revision
      pendingSearch = null
      emit({ loading: true, error: null })
    },
    fail(message: string) {
      emit({ loading: false, error: message })
    },
    search(changes: Record<string, unknown>, base?: CatalogParams) {
      pendingSearch = base
        ? { base, changes }
        : {
            base: pendingSearch?.base ?? state.catalog?.selection.params,
            changes: { ...pendingSearch?.changes, ...changes },
          }
      return run('search_products', pendingSearch)
    },
    next() {
      if (state.catalog?.next) return run('search_products', state.catalog.next)
    },
    open(position: number) {
      return run('get_product', {
        selection: state.catalog?.selection,
        position,
      })
    },
    compare() {
      return run('get_products', {
        identifiers: state.selectedIds,
        selection: state.catalog?.selection,
      })
    },
    select(id: string) {
      if (!state.catalog?.selection.productIds.includes(id)) return
      const ids = state.selectedIds.includes(id)
        ? state.selectedIds.filter((value) => value !== id)
        : [...state.selectedIds, id].slice(0, 4)
      emit({ selectedIds: ids })
      sync()
    },
    back() {
      ++revision
      pendingSearch = null
      if (
        state.data?.view !== 'catalog' &&
        !state.catalog &&
        state.data?.selection
      ) {
        return run(
          'search_products',
          { base: state.data.selection.params },
          { previousSelections: state.previousSelections },
        )
      }
      if (state.data?.view !== 'catalog' && state.catalog)
        emit({ data: state.catalog, loading: false, error: null })
      else {
        const previous = state.history.at(-1)
        if (!previous) {
          const remote = state.previousSelections.at(-1)
          if (remote)
            return run(
              'search_products',
              { base: remote.params },
              { previousSelections: state.previousSelections.slice(0, -1) },
            )
          return
        }
        emit({
          data: previous,
          catalog: previous,
          history: state.history.slice(0, -1),
          selectedIds: [],
          loading: false,
          error: null,
        })
      }
      sync()
    },
    restore(selection: CatalogSelection) {
      return run('search_products', { base: selection.params })
    },
    retry() {
      return lastRequest
        ? run(lastRequest.name, lastRequest.args, lastRequest.navigation)
        : run('search_products', { base: state.catalog?.selection.params })
    },
    sync,
  }
}
export type CatalogController = ReturnType<typeof createCatalogController>
