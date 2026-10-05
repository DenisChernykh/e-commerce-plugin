# Архитектура TIHO

## Изученные источники

До реализации изучены локальные проекты:

- Planner: `/Users/denischernykh/Documents/ChatGPT/planner`, main,
  `51ac3e8f88d958763befe3da81e0d33882103278`.
- React Starter: `/Users/denischernykh/Projects/starters/react-starter`, stage,
  `258b4e0a21022fc0894701e52885fd39b40469ee`.

Прочитаны AGENTS, README, package/config files, CI, Planner deployment,
composition root, Notes HTTP/application/repository, runtime config, Problem Details,
D1 migrations/tests и boundary checker. В React Starter — architecture overview,
bootstrap guide, shared UI guidelines, Orval, Axios mutator, QueryClient и
approval-request entity adapter. Исходные проекты не изменялись.

## Что перенесено

Backend повторяет текущий Planner: TypeScript, Hono + Zod OpenAPI, Cloudflare
Worker, D1/Drizzle, SQL migrations, `src/modules/<feature>/{domain,application,
infrastructure,presentation}`, capability-specific ports, ручная сборка зависимостей
в module `index.ts`, `app` composition root и `platform` для runtime. Никаких DI
containers, generic repositories, base services, Docker, очередей и Redis.
Planner уже не использует VPS/Compose: его актуальный деплой — Wrangler.

Frontend переносит FSD `app → pages → widgets → features → entities → shared`,
public `index.ts`, query/cache ownership в entity, Axios transport, нормализацию
ошибок, Orval snapshot/codegen, TanStack Query 5, Tailwind 4 и shadcn/Base UI Lyra.
Backend форматируется Biome, frontend — Prettier и ESLint, FSD проверяет Steiger.
Node 24, pnpm 11.15.1, один workspace/lockfile, агрегатный `pnpm check`, CI check-only.

Steiger запускается на временной копии исходников с той же конфигурацией: это
не позволяет его gitignore scanner обходить посторонний родительский репозиторий
при запуске магазина без собственного `.git`. Копия удаляется после проверки;
проверяемые правила не отключаются. `insignificant-slice` остаётся предупреждением,
как в Starter; корневые Next entrypoints вне `src` не учитываются этим правилом.

## Осознанная адаптация

Next App Router заменяет Vite/React Router. Корневая `frontend/app` содержит
тонкие route entrypoints; `src/app` — providers/styles, `src/pages` — композицию.
Пустая корневая `frontend/pages` предотвращает распознавание FSD-слоя `src/pages`
как Next Pages Router. Auth и approval-requests не переносятся: они вне задания.

Главная и товар рендерятся Server Components, каталог интерактивен и использует
entity React Query adapter. Один сгенерированный REST-контракт используется
сервером Next и браузером. Browser `/api/*` проходит через Next rewrite в Hono;
server requests идут напрямую на `API_BASE_URL`. Бизнес-логики в Next API нет.
Backend остаётся отдельным публичным REST API для будущих внешних клиентов.

## Каталог

Один модуль `catalog` владеет Product, Category, Brand, ProductImage и
ProductAttribute. Категории и бренды не выделены в искусственные сервисы.
UUID и slug стабильны. В БД цена — целые копейки, API/query — рубли с двумя
знаками; currency — RUB. Наличие — явный статус, без будущей модели складов.
Images — отдельная таблица; пока она пуста, frontend показывает локальные
декоративные иллюстрации. Изображения можно добавить без изменения API.

Поиск: нормализованный Unicode NFKC/lowercase/ё→е search text, все слова через
AND, подстроки с экранированными SQL LIKE metacharacters. Текст включает название,
описание, бренд, категорию, цвет, материал, тип и характеристики. Это лексический
поиск, без стемминга, семантического поиска и внешнего search engine.

Множественные значения фильтра разделяются запятыми: OR внутри одного поля,
AND между полями. Для attributes OR внутри ключа и AND между ключами.
Facets вычисляются для выбранных категорий, сохраняют доступные варианты при
применении остальных фильтров; это явно отражено в OpenAPI. Все sort имеют ID
как последний tie-breaker. Пагинация page/pageSize с total/totalPages.

## Развитие

Корзина/заказы/identity/payments могут стать соседними модулями с собственными
ports и public contracts. Денежные значения, идентичность и structured attributes
сохраняют возможность такого расширения. MCP/AI-клиент сможет использовать
публичный OpenAPI напрямую. Сейчас ни одна из этих возможностей не реализуется.
