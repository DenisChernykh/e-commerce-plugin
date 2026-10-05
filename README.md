# TIHO — искусство быть дома

Рабочий MVP каталога эстетичных товаров для дома. Next.js frontend и Hono API
с Cloudflare D1. 72 предмета, 6 категорий, 6 брендов. Покупки, авторизация и
платежи не входят в продукт. Каталог подключён к ChatGPT через MCP Apps.

Интеграция, сборка, установка и проверочные сценарии:
[docs/chatgpt-plugin.md](docs/chatgpt-plugin.md).

## Опубликованное demo

- Витрина: https://tiho-store.vercel.app
- Публичный API: https://tiho-api.tiho-backend.workers.dev/api/products
- OpenAPI: https://tiho-api.tiho-backend.workers.dev/openapi.json
- Контракт через витрину: https://tiho-store.vercel.app/openapi.json
- Подключение плагина: https://tiho-store.vercel.app/plugins
- Приватный MCP: https://tiho-catalog.scary-rustles-7p.chatgpt.site/mcp

Развёрнуто 5 октября 2026 в аккаунтах, выбранных в Google Chrome. Production
проверен без авторизации: frontend proxy и direct API используют настоящую D1.

## Запуск

Node 24 и pnpm 11.15.1. Из корня:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev
```

- Витрина: http://localhost:3000
- API: http://localhost:8787/api/products
- OpenAPI 3.1: http://localhost:8787/openapi.json
- OpenAPI через frontend: http://localhost:3000/openapi.json
- Liveness: http://localhost:8787/health

`pnpm dev` запускает два процесса с HMR. По отдельности: `pnpm dev:api` и
`pnpm dev:ui`. Локальная БД хранится в `backend/.wrangler/state`. Никаких
облачных credentials для локального запуска не требуется.

Для другого адреса API скопируйте `frontend/.env.example` в
`frontend/.env.local` и задайте `API_BASE_URL` без завершающего `/`.
Перезапустите Next после изменения адреса.

## Что работает

- Главная: hero, категории, редакционная подборка, визуальные блоки.
- Каталог: сетка, поиск, 5 сортировок, пагинация и фильтры в URL.
- Фильтры: несколько категорий, брендов, цветов, материалов, типов;
  диапазон цены, наличие, подборка, характеристики конкретных категорий.
- Карточка товара: бренд, цена, описание, характеристики, наличие, галерея,
  связанные товары. Отдельная страница категорий и category deep links.
- Адаптивный интерфейс, мобильные фильтры, loading/empty/error/404 состояния.
- Поиск по всем значимым данным, включая русский текст и характеристики.
- Типизированный Orval-клиент и React Query, сгенерированные из backend OpenAPI.

Фотографии ожидаются позже. Сейчас используются локальные SVG-иллюстрации;
товары с фотографиями автоматически используют `ProductImage.url` и галерею.
Нет внешних image/font сервисов, необходимых для просмотра demo.

## Структура

```text
backend/
  src/app/                 сборка Hono-приложения
  src/modules/catalog/    domain / application / infrastructure / presentation
  src/platform/           D1 schema, config, HTTP Problem Details
  migrations/             SQL-миграции Drizzle
  seed/                   данные 72 товаров и SQL upsert
  test/                   HTTP integration tests в Workers/D1
  wrangler.jsonc          local/production окружения
frontend/
  app/                    Next App Router entrypoints
  src/app/                QueryProvider, styles
  src/pages/              композиция главной, каталога, категорий, товара
  src/widgets/            StoreShell, CatalogGrid
  src/features/           действия поиска и фильтрации, URL state
  src/entities/product/   query adapters, server loaders, product UI
  src/shared/             transport, generated API, routes, shadcn UI
  openapi/                snapshot контракта
docs/                     архитектура, API и deployment runbook
```

Обоснование и точные изученные ревизии Planner/React Starter:
[docs/architecture.md](docs/architecture.md).

## API и данные

[Полный контракт поиска и фильтрации](docs/api.md).

```text
/catalog?category=candles&color=beige&material=soy&priceFrom=1000&priceTo=5000&sort=price_asc
/api/products?q=кедр&category=candles,diffusers&attribute=aroma:woody&availability=in_stock
```

`seed` — отдельная ручная команда, повторяемая по стабильным UUID.
Повторный запуск обновляет демонстрационные товары/характеристики, не удаляет
другие товары и уже добавленные изображения. Он не выполняется при старте,
сборке или деплое. Данные редактируются в `backend/seed/catalog.ts`.
Для изменения таблиц: изменить Drizzle schema, `pnpm db:generate`, проверить
новый SQL, `pnpm db:migrate:local`, тесты. Не переписывать применённые миграции.

## Проверки

```bash
pnpm api:update       # обновить snapshot и Orval из backend текущего checkout
pnpm check            # весь gate, совпадает с CI
pnpm test             # backend и frontend
pnpm typecheck
pnpm boundaries:check
pnpm build            # Next production build + Wrangler dry-run
```

`api:check` сравнивает артефакты по SHA-256 до/после генерации и работает даже
до первого Git commit. CI только проверяет код, без публикации и remote migrations.
Backend tests создают отдельную локальную D1 и применяют настоящие миграции.
`deploy:dry-run` не публикует Worker. Для production Next локально после
`pnpm build`: `pnpm --filter @tiho/frontend start` при работающем API.

Итог проверки: `pnpm check` проходит, 19 backend + 9 frontend tests, Orval
без рассинхронизации. Steiger выдаёт 3 рекомендательных `insignificant-slice`
предупреждения, без ошибок границ. Проверены поиск, фильтры, история URL,
пагинация, товары, категории и мобильная панель в браузере; production API
и Next proxy дополнительно проверены HTTP-запросами.

## Размещение

Backend — Cloudflare Workers + D1 через Wrangler, как в Planner. Frontend —
Vercel, Root Directory `frontend`, Node 24, `API_BASE_URL` на адрес Worker.
Подробная последовательность: [docs/deployment.md](docs/deployment.md).

Backend публичный read-only; CORS разрешает внешним клиентам GET.
Browser requests идут через Next rewrite, серверные страницы обращаются
напрямую к тому же API. Конфиденциальных ключей API в браузере нет.

## Следующие этапы

Фотографии и реальные данные; затем по необходимости корзина, заказы,
identity/auth, оплаты, остатки, admin, AI-поиск и MCP/ChatGPT. Сейчас нет
фиктивных кнопок покупки, публичных write endpoint'ов, очередей, Redis,
микросервисов, аналитики или избыточной инфраструктуры.
