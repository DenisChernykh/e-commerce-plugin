# TIHO в ChatGPT

Магазин: https://tiho-store.vercel.app. Раздел подключения:
https://tiho-store.vercel.app/plugins.

Плагин: https://chatgpt.com/plugins/plugin_asdk_app_sites_1619538f0004819198c41c0f9b2343df.
MCP: https://tiho-catalog.scary-rustles-7p.chatgpt.site/mcp.
Плагин опубликован приватно; доступ определяется аккаунтом и правилами Sites.
Он не опубликован в публичном каталоге плагинов.

## Архитектура и референсы

`chatgpt/` — отдельный stateless Worker по образцу Planner и Social Analytics.
`WebStandardStreamableHTTPServerTransport`, MCP SDK 1.29.0, MCP Apps 2.0.3.
Адаптер вызывает только существующие публичные GET endpoints backend TIHO.
Hono/D1 остаётся единственным источником каталога. Фильтрация, ранжирование,
цены и page/pageSize исполняются существующим backend; новой БД нет.

Planner дал транспорт, сборку самодостаточного UI resource, общий React frontend,
bridge и режимы inline/fullscreen. Его веб-раздел называется «Подключения»:
иконка Plug, отдельная страница, копирование с обработкой ошибки. TIHO использует
эту структуру с требуемым названием «Плагины», без личного API-ключа Planner.

Social Analytics дал Sites-размещение тонкого адаптера к реальному API,
structuredContent/isError, строгую проверку контрактов и переносимый пакет
plugin.json + mcp.json + skills. В изученном Social Analytics отдельного
веб-сайдбара нет; не следует приписывать ему эту реализацию.

UI не вставляет Next-страницу в iframe. Vite собирает небольшой entrypoint
`frontend/src/app/chatgpt/main.tsx` с общими ProductCardContent, ProductImage,
FilterPanel, ActiveFilters, кнопками, стилями и шрифтами магазина. Полученный
HTML доступен как `ui://tiho/catalog-<hash>.html`, MIME `text/html;profile=mcp-app`.
К backend из iframe запросов нет: `app.callServerTool` проходит через хост.

## Инструменты

| Tool | Назначение |
| --- | --- |
| `search_products` | Текстовый поиск, фильтры, сортировка всей выборки, страницы |
| `get_product` | Полные данные по UUID/slug либо позиции конкретной selection |
| `get_products` | Характеристики 2–4 конкретных товаров для сравнения |
| `get_catalog_filters` | Реальные значения категорий и характеристик |
| `open_store` | Новый визуальный каталог, карточка или сравнение |
| `tiho_home` | Отдельная точка входа TIHO в боковом меню ChatGPT |

Все server tools read-only. Их строгие schemas используют существующий HTTP
контракт `@tiho/backend/catalog-contracts`. Единственное изменение backend —
экспорт его схем; endpoints, SQL, база и доступ не изменены.

Продолжение поиска: `base=selection.params`, `changes` содержит только изменяемые
поля. `null` удаляет одно ограничение. Новый фильтр сбрасывает только страницу.
`next` содержит запрос следующей страницы; `pagination.total` точен. Сортировка
выполняется до LIMIT/OFFSET. UUID товаров и канонические URL приходят из API.

Ошибка backend возвращается как isError; пустая выдача — успешный ответ с
items=[], total=0, next=null. Неизвестные характеристики при сравнении обозначены
«Нет данных». Отсутствующие фотографии не подменяются выдуманными: используются
те же SVG-иллюстрации ObjectArt с явной подписью.

## Состояние интерфейса и разговор

У каждого UI экземпляра собственные controller, uiInstanceId, история последних
8 подборок и упорядоченный selection.productIds. Состояние отправляется модели
через `ui/update-model-context`, включая фильтры, выбранные ID и историю.
Порядковые номера относятся только к этой selection. Конфликт ID подборки
требует перечитать состояние, а не выбрать случайный товар.

В диалоге `open_store` показывает обновлённый визуальный результат. В него
передаются текущие фильтры и previousSelections из UI context: при смене
фильтра или страницы текущая selection добавляется к истории, при открытии
карточки история сохраняется, при возврате последняя selection извлекается.
Новый экземпляр UI восстанавливает эту историю без общей серверной сессии.
Ручные действия обновляют текущую панель через app.callServerTool.
Текстовые server tools сохраняются для вопросов без интерфейса.

App-provided tools из draft MCP Apps не используются: в проверенном ChatGPT
они не предоставляются модели. Штатный визуальный server tool проверен
непосредственно в ChatGPT. Интерфейс открывается из диалога, поддерживает
inline/fullscreen. Отдельный `tiho_home` регистрирует global entrypoint с иконкой
TIHO, как в Planner и Social Analytics. Он открывает тот же каталог без фильтров;
`open_store` продолжает показывать подборки разговора и не является global entrypoint.
Монохромная монограмма имеет прозрачный фон: ChatGPT использует альфа-маску
при окрашивании значков в боковом меню.

При быстрых изменениях фильтры объединяются, а запоздавшие ответы не заменяют
более новую подборку. Открытие карточки сохраняет список; возврат восстанавливает
его снимок. Отдельные чаты не используют общее состояние или localStorage.

## Сайдбар и установка

В desktop-сайдбаре TIHO есть Plug и «Плагины» с активным состоянием; на мобильном
та же ссылка находится в выдвижной навигации. Раздел содержит описание, реальные
демо-запросы, переход к созданному плагину, копирование MCP URL, скачивание ZIP
и официальную инструкцию. Статус подключения на сайте не имитируется.

Откройте раздел «Плагины», перейдите в ChatGPT, установите TIHO и завершите
предлагаемый вход через ChatGPT. Используется OAuth, предоставленный Sites;
серверные или административные ключи магазина не нужны.

После изменения tools или точек входа обновите метаданные существующего
подключения: страница TIHO → «Ещё действия» → «Управлять» →
«Обновить инструменты». Это штатная операция ChatGPT; повторная установка
или создание нового плагина не требуется.

Новая точка входа появляется в меню «Обзор» (многоточие слева). Наведите на TIHO
и нажмите «Закрепить на боковой панели». После этого иконка открывает каталог
непосредственно из сайдбара. В проверенном аккаунте TIHO уже закреплён рядом
с Ритмом и Social Analytics; закрепление сохраняется после обновления страницы.

ZIP доступен по `/plugins/tiho-plugin.zip`; внутри корневые plugin.json,
mcp.json и `skills/catalog-selection/SKILL.md`. Описание навыка включается также
в server instructions при сборке и доступно через MCP resource
`skill://tiho/catalog-selection/SKILL.md`. Это действующие инструкции, а не
несвязанный Markdown-файл. Цены и списки товаров в skill не зашиты.

## Разработка и сборка

Нужны Node 24, pnpm 11.15.1 и системный zip (он проверен также в Vercel build).

```bash
pnpm install --frozen-lockfile
pnpm chatgpt:dev
```

MCP — `http://127.0.0.1:8790/mcp`; тестовый MCP Apps host —
`http://127.0.0.1:8790/preview`. По умолчанию он читает реальный опубликованный
каталог. Это тестовый host, а не ChatGPT, и его нельзя выдавать за проверку
целевого приложения.

`chatgpt/.env.example` содержит CATALOG_API_URL, STORE_URL, PORT без секретов.
Скопируйте его в `chatgpt/.env`, если нужны другие значения. Для локальной D1
сначала выполните обычные команды магазина из README, затем задайте
`CATALOG_API_URL=http://127.0.0.1:8787`. MCP dev после пересборки перезапускается.

```bash
pnpm chatgpt:build
pnpm check
node chatgpt/scripts/verify-live.mjs
node chatgpt/scripts/verify-browser.mjs
```

Последние две команды требуют запущенный MCP dev; browser smoke дополнительно
требует установленный agent-browser. Они работают с реальным backend.
Отчёты и снимки пишутся в игнорируемый `artifacts/`. Для другого MCP адреса
задайте MCP_URL. Приватный Sites допускает штатный сервисный доступ через
`--sites-auth-stdin`; ключ вводится скрыто, не попадает в аргументы или файлы.
В текущей сети запросы терминала к Sites блокирует Cloudflare, поэтому отдельно
проверяется реальное OAuth-подключение и работа UI в ChatGPT.

## Размещение

Магазин остаётся на прежнем Vercel project `tiho-store`, backend — в прежнем
Cloudflare Worker. Миграция базы или развёртывание новых API не требуется.
Frontend prebuild создаёт ZIP; рабочая команда публикации из корня:

```bash
pnpm dlx vercel@62.2.0 deploy --prod --scope denis-projects-91ecd61e --yes
```

Для MCP используется уже созданный Sites project из
`chatgpt/.openai/hosting.json`. После проверок и `pnpm chatgpt:build`:

```bash
node chatgpt/scripts/export-sites.mjs
```

Экспорт сохраняет один канонический workspace, копирует исходники и совпадающий
Worker build в `.sites-export`, исключая credentials, env, базы, browser data,
node_modules и artifacts. Далее стандартный Sites workflow отправляет commit и
архив dist, затем выполняется private deploy того же project_id. Не регистрируйте
новый плагин при обновлении. Временные credentials передаются только скрытым
stdin стандартного workflow, не сохраняются в репозитории.

## Демонстрация на реальном каталоге

- «Покажи соевые свечи до 3000 ₽ в наличии, сначала дешевле, по 3 на странице».
- «Теперь оставь бежевые. Убери ограничение по цвету».
- «Покажи ещё. Вернись к предыдущей подборке».
- «Открой второй вариант из показанной подборки».
- «Сравни первый и третий: важны аромат, время горения и цена».
- «Найди „Олива“» — название неоднозначно; нужно выбрать из найденного.
- «Подбери что-то уютное из льна до 3000 ₽» — „уютное“ является интерпретацией,
  факты о материале, цене и наличии берутся из tools.

Статус каждого обязательного сценария и фактические свидетельства:
[plugin-progress.md](plugin-progress.md).

## Контракты

Проверено по актуальным первоисточникам:
[OpenAI MCP UI](https://developers.openai.com/plugins/build/chatgpt-ui),
[OpenAI extensions](https://developers.openai.com/plugins/build/extensions),
[MCP Apps app tools](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx),
[упаковка](https://developers.openai.com/plugins/build/plugins),
[подключение](https://developers.openai.com/plugins/deploy/connect-chatgpt).
