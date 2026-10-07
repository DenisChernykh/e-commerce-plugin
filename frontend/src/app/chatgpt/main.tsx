import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import { createRoot } from 'react-dom/client'
import { useCallback } from 'react'
import {
  ShoppingProvider,
  createShoppingController,
  useShopping,
} from '@/features/shopping'
import { createMcpShoppingClient, type ShoppingTarget } from '@/shared/api'
import { CheckoutFlow } from '@/widgets/checkout'
import { observePageVisibility } from '@/shared/lib/visible-polling'
import { type CatalogBridge, type ToolResult } from '@/shared/api'
import {
  ChatgptCatalog,
  createCatalogController,
} from '@/widgets/chatgpt-catalog'
import '../styles/index.css'
import './theme.css'

const app = new App(
  { name: 'TIHO', version: '0.2.0' },
  {},
  { autoResize: true },
)
let modelContext: Record<string, unknown> = {}
let panelVisible = false
const bridge: CatalogBridge = {
  callTool: async (name, args) => {
    await connected
    return (await app.callServerTool({ name, arguments: args })) as ToolResult
  },
  publishContext: async (context) => {
    modelContext = { ...modelContext, ...context }
    await connected
    if (!panelVisible) return
    return app.updateModelContext({
      structuredContent: modelContext,
      content: [
        {
          type: 'text',
          text: JSON.stringify(modelContext),
          annotations: { audience: ['assistant'] },
        },
      ],
    })
  },
  openLink: async (url) => {
    const result = await app.openLink({ url })
    if (result.isError) controller.fail('Не удалось открыть ссылку на магазин.')
  },
  fullscreen: () => app.requestDisplayMode({ mode: 'fullscreen' }),
}
const controller = createCatalogController(bridge)
const shopping = createShoppingController(
  createMcpShoppingClient(bridge),
  bridge.publishContext,
)
function StoreApp() {
  const { target } = useShopping()
  const navigate = useCallback(
    (next: ShoppingTarget) => shopping.open(next),
    [],
  )
  return target ? (
    <CheckoutFlow
      key={`${target.screen}:${target.orderId ?? target.order?.id ?? ''}:${target.quote?.id ?? ''}`}
      target={target}
      navigate={navigate}
      continueShopping={() => shopping.open(null)}
    />
  ) : (
    <ChatgptCatalog controller={controller} bridge={bridge} />
  )
}
const root = createRoot(document.getElementById('root')!)
root.render(
  <ShoppingProvider controller={shopping}>
    <StoreApp />
  </ShoppingProvider>,
)
function applyContext(context: Partial<McpUiHostContext>) {
  if (context.theme) document.documentElement.dataset.theme = context.theme
}
app.onhostcontextchanged = applyContext
app.ontoolinput = (input) => {
  if (
    !['cart', 'checkout', 'payment', 'order', 'orders'].includes(
      String(input.arguments?.view),
    )
  )
    controller.beginHostRequest()
}
app.ontoolresult = (result) => {
  const toolResult = result as ToolResult
  const data = toolResult.structuredContent?.data as
    { view?: string } | undefined
  if (data?.view === 'shopping')
    shopping.receive(data as Parameters<typeof shopping.receive>[0])
  else if (
    data?.view &&
    ['catalog', 'product', 'compare'].includes(data.view)
  ) {
    shopping.open(null)
    controller.receive(toolResult)
  } else if (toolResult.isError) controller.receive(toolResult)
}
app.ontoolcancelled = () =>
  controller.fail('Запрос отменён. Можно повторить его.')
const stopVisibility = observePageVisibility((visible) => {
  panelVisible = visible
  if (visible) void bridge.publishContext({}).catch(() => {})
})
app.onteardown = async () => {
  stopVisibility()
  root.unmount()
  return {}
}
const connected = app.connect()
void connected
  .then(() => applyContext(app.getHostContext() ?? {}))
  .catch(() =>
    controller.fail(
      'Не удалось подключиться к ChatGPT. Закройте и снова откройте TIHO.',
    ),
  )
