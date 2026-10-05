import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import { createRoot } from 'react-dom/client'
import { type CatalogBridge, type ToolResult } from '@/shared/api'
import {
  ChatgptCatalog,
  createCatalogController,
} from '@/widgets/chatgpt-catalog'
import '../styles/index.css'
import './theme.css'

const app = new App(
  { name: 'TIHO', version: '0.1.0' },
  {},
  { autoResize: true },
)
const bridge: CatalogBridge = {
  callTool: async (name, args) => {
    await connected
    return (await app.callServerTool({ name, arguments: args })) as ToolResult
  },
  publishContext: (context) =>
    app.updateModelContext({
      structuredContent: context,
      content: [
        {
          type: 'text',
          text: JSON.stringify(context),
          annotations: { audience: ['assistant'] },
        },
      ],
    }),
  openLink: async (url) => {
    const result = await app.openLink({ url })
    if (result.isError) controller.fail('Не удалось открыть ссылку на магазин.')
  },
  fullscreen: () => app.requestDisplayMode({ mode: 'fullscreen' }),
}
const controller = createCatalogController(bridge)
const root = createRoot(document.getElementById('root')!)
root.render(<ChatgptCatalog controller={controller} bridge={bridge} />)
function applyContext(context: Partial<McpUiHostContext>) {
  if (context.theme) document.documentElement.dataset.theme = context.theme
}
app.onhostcontextchanged = applyContext
app.ontoolinput = () => controller.beginHostRequest()
app.ontoolresult = (result) => controller.receive(result as ToolResult)
app.ontoolcancelled = () =>
  controller.fail('Запрос отменён. Можно повторить его.')
app.onteardown = async () => {
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
