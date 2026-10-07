# TIHO — искусство быть дома

Магазин товаров для дома: Next.js, Hono API, Cloudflare D1 и MCP Apps в ChatGPT.
72 предмета, 6 категорий, 6 брендов. Корзины, заказы и попытки оплаты сохраняются
на backend. В презентационном окружении оплата проходит через внутренний адаптер
без банка и списаний. Публичная витрина пока остаётся каталогом.

Интеграция, сборка, установка и проверочные сценарии:
[docs/chatgpt-plugin.md](docs/chatgpt-plugin.md).
Покупательский сценарий, доступ, миграции и платёжные режимы:
[docs/checkout.md](docs/checkout.md). Фактический статус проверок:
[docs/checkout-progress.md](docs/checkout-progress.md), подробные свидетельства:
[docs/checkout-verification.md](docs/checkout-verification.md).

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
- Серверная корзина, количество, контакты, проверка заказа, оплата и заказы
  на сайте и через MCP Apps. Повторы запросов и конкурентные изменения безопасны.
- Проверка владельца и одноразовый переход из плагина к своей корзине на сайте.

Фотографии ожидаются позже. Сейчас используются локальные SVG-иллюстрации;
товары с фотографиями автоматически используют `ProductImage.url` и галерею.
Нет внешних image/font сервисов, необходимых для просмотра demo.

## Структура

```text
backend/
  src/app/                 сборка Hono-приложения
  src/modules/catalog/    domain / application / infrastructure / presentation
  src/modules/commerce/   корзина, checkout, заказы, сессии и внутренний адаптер
  src/platform/           D1 schema, config, HTTP Problem Details
  migrations/             SQL-миграции Drizzle
  seed/                   данные 72 товаров и SQL upsert
  test/                   HTTP integration tests в Workers/D1
  wrangler.jsonc          local/presentation/production окружения
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

Актуальные результаты и границы проверки (включая отличие локального MCP host
от настоящего ChatGPT) записаны в [checkout-progress.md](docs/checkout-progress.md).

## Размещение

Backend — Cloudflare Workers + D1 через Wrangler, как в Planner. Frontend —
Vercel, Root Directory `frontend`, Node 24, `API_BASE_URL` на адрес Worker.
Подробная последовательность: [docs/deployment.md](docs/deployment.md).

Публичный каталог доступен на чтение; commerce требует подтверждённой сессии.
Browser requests идут через Next rewrite, серверные страницы обращаются
напрямую к тому же API. Конфиденциальных ключей API в браузере нет.

## Следующие этапы

Настоящий платёжный провайдер, доставка, резервирование, списание остатков,
чеки и уведомления не реализованы и не имитируются. Публичный торговый запуск
требует отдельного решения и не входит в эту работу.
