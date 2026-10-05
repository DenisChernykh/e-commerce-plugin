# TIHO / ChatGPT — обязательные требования и проверки

Статусы: не начато / в работе / проверено / заблокировано.
Локальная проверка, опубликованный MCP и проверка в ChatGPT фиксируются отдельно.

| Требование | Статус | Свидетельство |
| --- | --- | --- |
| Изучить магазин, Planner и Social Analytics | проверено | README, AGENTS, MCP server/transport, UI bridge, build, skills, sidebar/connections, API/D1 и URL state прочитаны |
| Тонкий MCP к реальному backend, строгие schemas, annotations и ошибки | проверено | 5 сценарных tools + read-only tiho_home для бокового меню ChatGPT; 25 backend/D1 + MCP integration tests |
| Поиск по нескольким фильтрам, сортировка всей выборки, страницы | проверено | D1 integration, live API smoke: exact total, backend sort, все страницы совпали с полной выборкой |
| Изменение и снятие одного фильтра с сохранением остальных | проверено | D1 integration + browser: category/availability/color; снятие цвета сохраняет остальные поля |
| Детали, канонические ссылки, выбор по номеру | проверено | live API; browser open 2/back; ChatGPT верно определил вторую свечу после ручного выбора категории |
| Сравнение нескольких товаров, неоднозначные названия | проверено | get_products по positions и UUID; UI сравнивает 1 и 3; поиск «Олива» даёт несколько кандидатов |
| История подборок, возврат, согласованность UI и чата | проверено | ChatGPT: «Теперь только бежевые» → «Вернись к предыдущей подборке»; ручной возврат из карточки → сравнение 1 и 3. open_store передаёт previousSelections; восстановление после нового UI и ошибки покрыто тестами |
| Изоляция UI, защита от устаревших ответов | проверено | Unit tests: races/rapid changes; два независимых iframe с разными uiInstanceId и selection.id |
| Общие компоненты, изображения, фильтры, loading/empty/error | проверено | ProductCardContent/ProductImage/FilterPanel общие; browser empty + fault injection error/retry, реальные данные |
| Текстовые tools без обязательного UI | проверено | Live API smoke; ChatGPT дал текстовое сравнение без нового UI, с реальными ароматами, ценами и временем горения |
| Сайдбар: «Плагины», иконка, active/hover, мобильная версия | проверено | Production desktop/sidebar active + mobile drawer; иконка Plug и переход /plugins |
| Рабочий раздел подключения и его действия | проверено | Production: copy success, download ZIP, реальная страница установки ChatGPT, официальный docs URL |
| Подключённые server instructions и skill, пакет | проверено | initialize содержит полный skill; resources/read тот же SKILL.md; проверен скачанный ZIP без секретов |
| Env example, запуск/сборка/подключение, реальные демо-запросы | проверено | chatgpt/.env.example; docs/chatgpt-plugin.md; фактические примеры соевых свечей, льна, «Олива» |
| Empty, invalid ID/params, backend failure и их различие | проверено | D1 + live API + worker outage tests: ошибка не подменяется пустой выдачей |
| Регрессионные проверки каталога и полный локальный gate | проверено | pnpm check: 25 backend + 21 frontend + 3 worker теста, API snapshot, linters/types/builds; production catalog page 2 + product details |
| Реальная браузерная проверка магазина и MCP UI | проверено | 8 групп browser smoke; production desktop/mobile /plugins, каталог и товар; ChatGPT UI отрисован, ручной фильтр виден модели |
| Публикация и проверка целевого окружения | проверено | Vercel production READY; Sites private v4 succeeded; реальный ChatGPT читает опубликованный MCP. Скачанный production ZIP совпадает с исходниками |
| Подключение и проверка внутри ChatGPT | проверено | Штатная установка/OAuth; чистый диалог: фильтры, уточнение, возврат, 2-й товар, сравнение 1/3 и его визуальная таблица; отдельный диалог: снятие цвета и page 2 |
| Дополнение: иконка TIHO в боковом меню самого ChatGPT | проверено | tiho_home опубликован, метаданные обновлены; TIHO закреплён через «Обзор». Нажатие открывает настоящий каталог (72 товара), закрепление сохраняется после перезагрузки. Прозрачная монограмма корректно отображается рядом с Ритмом и Social Analytics |

## Подтверждённые решения референсов

- Planner: `chatgpt/src/worker.ts`, `server.ts`, `scripts/build.mjs`, общий
  `frontend/src/app/chatgpt/main.tsx`; MCP SDK 1.29.0, MCP Apps 2.0.3,
  stateless Streamable HTTP, самодостаточный HTML, inline/fullscreen.
- Planner web: `planner-sidebar.tsx` → `connections-page.tsx`, иконка `Plug`,
  подпись **«Подключения»**, отдельная страница, копирование и обработка ошибки.
  Его личные ключи здесь не нужны: каталог TIHO публичный.
- Social Analytics: отдельный Sites adapter к существующему API, валидация
  результатов, structuredContent, isError, пакет `plugin/plugin.json`,
  `mcp.json`, `skills/media-statistics/SKILL.md`. Собственного web-сайдбара нет;
  инструкции описывают системный раздел «Плагины» ChatGPT.
- TIHO: Hono/D1 backend, Next frontend, 72 демонстрационных товара, RUB,
  `/api/products`, `/api/products/{identifier}`, `/api/catalog/facets`.
  SQL фильтрует и сортирует до LIMIT/OFFSET; page/pageSize/total/totalPages.
  Изображения могут отсутствовать: магазин показывает SVG ObjectArt.

## Границы

Без LLM API, новой базы, профилей, авторизации, корзины или admin endpoints.
UI остаётся частью frontend магазина и собирается отдельно в MCP resource.
Долговременное/общее состояние чатов не вводится.

## Итоговая проверка 2026-10-05

- `pnpm check`: 25 backend/D1 + 21 frontend + 3 Worker теста, schemas,
  генерация OpenAPI, границы модулей, lint/format, TypeScript и обе сборки.
- `verify-live.mjs`: 6 групп через локальный MCP и настоящий production API.
- `verify-browser.mjs`: 8 групп в браузере с настоящим API. Искусственно
  прерывается только сеть в отдельной проверке error/retry; товары не подменяются.
- Production магазин: desktop/sidebar, mobile drawer, /plugins, копирование
  настоящим нажатием в Chrome, скачивание актуального ZIP; каталог с фильтрами,
  page 2 и подробности товара.
- Настоящий ChatGPT: установка и OAuth, визуальная подборка соевых свечей
  до 3000 ₽ в наличии (5 товаров), сортировка price_asc, уточнение цвета
  (1 товар), снятие цвета (5), page 2 (2 оставшихся), возврат (5),
  второй товар «Чистый хлопок» (1800 ₽), ручной возврат и сравнение первого
  «Лаванда» (1600 ₽, 50 часов) с третьим «Тихое утро» (2400 ₽, 40 часов).
  Проверены текстовый вывод и визуальная таблица с настоящими характеристиками.
  Поиск «Олива» без UI вернул пиалу и наволочку, не выбрав один товар.
  Кнопка «Открыть» из сравнения проходит штатное подтверждение внешней ссылки
  ChatGPT и ведёт на /products/candle-lavender.

Отчёты и снимки находятся в игнорируемой папке `artifacts/`. Важное различие:
App-provided tools из draft MCP Apps не доступны модели в проверенном ChatGPT.
Итоговый UI использует подтверждённый server tool open_store и передачу
previousSelections; черновой app-tool удалён. Версия UI resource зависит от
содержимого сборки. Общей серверной сессии или дополнительной базы нет.

Прямой запрос терминала к приватному Sites остановлен Cloudflare, включая
попытку штатного сервисного доступа. Проверка целевого окружения выполнена
через реальную установку, OAuth и вызовы tools из ChatGPT; этот сетевой
маршрут не является незавершённым пользовательским сценарием.

Обязательных незавершённых требований и подтверждённых внешних блокеров нет.

### Дополнение: боковое меню ChatGPT

Отдельная команда `tiho_home` использует global entrypoint из обоих референсов
и тот же UI каталога. `open_store` сохраняет обычные визуальные ответы в диалоге.
ChatGPT размещает новую команду в «Обзоре»; в проверенном аккаунте TIHO
закреплён штатной кнопкой «Закрепить на боковой панели». Проверены нажатие,
каталог из production API и сохранение закрепления после перезагрузки.
Монограмма использует прозрачные SVG paths: непрозрачный цветной фон
сливался бы в квадрат при применении альфа-маски ChatGPT.

Публикация `appgdep_6ac3c536f9388191b897a76292c8772a` завершилась успешно.
После последнего изменения иконки повторно прошли MCP lint/typecheck,
3 Worker теста и сборка; полный gate из 49 тестов был пройден после добавления
`tiho_home`. Снимки проверки: `artifacts/tiho-sidebar-icon-final.png`
и `artifacts/tiho-sidebar-catalog-before-icon-refresh.png`.
