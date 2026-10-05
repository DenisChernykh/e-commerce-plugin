# Размещение

Порядок соответствует Planner: локальный gate → ручные D1 migrations → ручной
Wrangler deploy. Frontend размещается отдельно на Vercel по условию задачи.
CI не имеет deploy jobs и не меняет облачные данные.

## Cloudflare

Созданы отдельные `tiho-api` и D1 `tiho-catalog` в аккаунте
`957388230aa7bf90d15b1bb81fbd5308`, выбранном пользователем в Chrome.
Database ID: `8501a948-1c4f-45a8-8346-f2ed855355ca`.
Адрес API: https://tiho-api.tiho-backend.workers.dev.
Bindings уже записаны в `backend/wrangler.jsonc`; локальная D1 остаётся отдельной
от remote. Planner и его Cloudflare-аккаунт не менялись.

На этой машине обычный Wrangler авторизован в другом аккаунте. Для магазина
используется отдельный штатный XDG-профиль, исключённый из Git и Vercel upload.
Из корня проекта, перед любыми remote-командами:

```bash
export XDG_CONFIG_HOME="$PWD/.wrangler/auth"
export WRANGLER_SEND_METRICS=false
pnpm --filter @tiho/backend exec wrangler whoami
```

Проверить, что account ID совпадает с указанным выше. При необходимости нового
входа (или на другой машине) авторизовать профиль через Chrome:

```bash
pnpm --filter @tiho/backend exec wrangler login --device --browser=false \
  --scopes account:read user:read workers:write workers_scripts:write d1:write
```

CLI выдаст URL и короткий одноразовый код. Нужны только Workers/D1 scopes;
предупреждение об отсутствующих правах других Cloudflare-продуктов ожидаемо.
Не публикуйте содержимое `.wrangler/auth` и не копируйте его в другие проекты.

Обычное обновление из корня:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm db:migrate:remote
pnpm db:seed:remote
pnpm deploy:api
```

Remote seed обновляет демонстрационный набор; используйте его осознанно после
ручного редактирования товаров. Ни deploy, ни startup не запускают seed/migrations.
`BUILD_REVISION` можно менять на текущую версию или Git SHA при публикации.
После изменения Wrangler bindings выполнить `pnpm --filter @tiho/backend typegen`.

При переносе в другой аккаунт сначала создать отдельную D1 (`wrangler d1 create`),
заменить account/database IDs в конфигурации и повторить migrations/seed/deploy.
Нельзя использовать Planner DB. Новый workers.dev subdomain может потребовать
нескольких минут на выпуск TLS до первого успешного запроса.

Проверить опубликованный `/health`, `/api/products` (72 предмета), фильтры,
товар по slug и `/openapi.json`. `/health` сам по себе не доказывает работу D1.

## Vercel

Проект `tiho-store` создан в `denis-projects-91ecd61e` (Denis' projects, Hobby).
Production URL: https://tiho-store.vercel.app.
Настройки подтверждены в Google Chrome:

- Framework: Next.js.
- Root Directory: `frontend`.
- Include source files outside Root Directory: включено (pnpm workspace).
- Node: 24.x.
- Install: `pnpm install --frozen-lockfile` из workspace.
- Build: `pnpm build` внутри frontend (не root aggregate build).
- Output Directory: framework default `.next`.
- Environment: `API_BASE_URL=https://tiho-api.tiho-backend.workers.dev`,
  уже задана для Production и Preview. Это публичный адрес, не секрет.

Git-интеграция необязательна: можно связать проект через `vercel link` и
публиковать исходники с CLI. Для монорепозитория связывайте корень с проектом,
где `rootDirectory=frontend`, затем выполняйте `vercel deploy --prod` из корня.
Не публикуйте `.env.local`, `.dev.vars`, `.wrangler`, node_modules и credentials.
`.vercelignore` исключает их явно; список загружаемых файлов проверен через
`vercel deploy --dry`. Авторизацию других проектов не меняли.

Повторная публикация без Git-интеграции:

```bash
pnpm check
pnpm dlx vercel@62.2.0 whoami
pnpm dlx vercel@62.2.0 link --project tiho-store --scope denis-projects-91ecd61e --yes
pnpm dlx vercel@62.2.0 deploy --prod --scope denis-projects-91ecd61e --yes
```

Если `.vercel/project.json` уже существует с правильной привязкой, повторный
`link` не нужен. Production alias доступен без входа; стандартная защита preview
deployments не отключалась. Платные upgrades, custom domains и Git integration
не настраивались. GitHub Actions подготовлен, но удалённый CI ещё не запускался:
проект пока публикуется из текущего checkout через CLI, как ручной deploy Planner.

Next rewrites проксирует browser `/api/*` и `/openapi.json` на Worker.
Server Components используют тот же `API_BASE_URL` напрямую. Изменение адреса
требует новой сборки из-за rewrites. Никаких Next-specific business endpoints.

Проверка после публикации: главная, каталог с несколькими query-фильтрами,
обновление страницы, back/forward, сортировка, пагинация, товар, категории,
мобильная панель и 404. Проверить direct API и frontend proxy независимо.

Первая публикация 2026-10-05: Worker version
`161310f8-7e2c-49f7-b780-76e10b765ae0`, Vercel deployment
`dpl_G2XUTXQetBBUUihLvt8rzc8yCNPm`, статус READY. Локальный gate и облачная
production-сборка прошли; в D1 72 товара, 6 категорий и 6 брендов.
Нет отдельной observability-инфраструктуры: только штатные платформенные логи,
без drains, сторонних агентов и custom alerts.

## Переносимость

Frontend — обычный Next.js Node runtime с `output: standalone`, без Vercel SDK
и привязки к proprietary storage. Возможен стандартный Node-хостинг. Cloudflare
frontend adapter сейчас не добавляется; backend уже работает на Workers/D1.
