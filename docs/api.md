# TIHO Catalog API

Источник контракта — Hono `createRoute` + Zod. OpenAPI 3.1 доступен на
`GET /openapi.json`, одинаковый для frontend и внешних клиентов.

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/products` | каталог, поиск, фильтры, сортировка, пагинация |
| GET | `/api/products/{identifier}` | товар по UUID или slug |
| GET | `/api/products/{identifier}/related?limit=4` | та же категория, без текущего товара |
| GET | `/api/categories` | категории в порядке отображения |
| GET | `/api/brands` | бренды |
| GET | `/api/catalog/facets?category=candles` | доступные значения фильтров |
| GET | `/health` | liveness Worker и build revision, без проверки D1 |

## Фильтрация

Все параметры optional. Неизвестные query-поля в каталоге возвращают `400`.

| Параметр | Формат |
| --- | --- |
| `q` | до 160 символов и 8 слов; все слова должны встретиться в search text |
| `category`, `brand`, `color`, `material`, `type` | до 10 slug через запятую |
| `priceFrom`, `priceTo` | включительно, рубли, до 2 знаков после точки |
| `availability` | `in_stock` или `out_of_stock` |
| `featured` | `true` или `false` |
| `attribute` | до 8 пар `key:value` через запятую |
| `sort` | `recommended` (default), `price_asc`, `price_desc`, `newest`, `name_asc` |
| `page` | 1–10000, default 1 |
| `pageSize` | 1–48, default 12 |

OR внутри одного измерения, AND между разными. Характеристики группируются
по ключу: `aroma:woody,aroma:floral,volume:200` означает (древесный ИЛИ цветочный)
И объём 200 мл. Ключи и варианты получайте из facets, не из UI-текстов.
Неправильный диапазон цены — `400`, неизвестный корректный slug — пустой список.

```bash
curl 'http://localhost:8787/api/products?category=candles,diffusers&color=beige,green&priceFrom=1000&priceTo=3500&attribute=aroma:woody&sort=price_asc'
curl --get 'http://localhost:8787/api/products' --data-urlencode 'q=СОЕВЫЙ СВЕЧА'
curl 'http://localhost:8787/api/products/candle-quiet-morning'
```

Ответ: `{ items: Product[], pagination: { page, pageSize, total, totalPages } }`.
За пределами последней страницы items пустой, total сохраняется. Все сортировки
имеют ID tie-breaker. Поиск буквальный, регистронезависимый, `ё` эквивалентно `е`,
SQL wildcard `%`, `_`, `\` экранируются. Нет скрытых AI-эвристик или синонимов.

Facets и price range учитывают только выбранные категории. Counts категорий
всегда глобальные. Другие активные фильтры не сужают варианты facets: пользователь
может расширять выбор. Это не количество совпадений текущего поискового запроса.

## Structured data

У Product есть UUID, slug, SKU, price/currency, category, brand, color, material,
type, availability, featured, ISO createdAt, images и attributes. Объекты опций
содержат machine-readable slug и русское name. Атрибут содержит key, name, value,
label и nullable unit. Цена API в рублях; БД хранит целые копейки.

Ошибки — `application/problem+json`: type, title, status, detail, instance,
code, requestId. Коды: `VALIDATION_FAILED`, `PRODUCT_NOT_FOUND`, `NOT_FOUND`,
`INTERNAL_ERROR`. Неожиданные ошибки не выдают SQL или stack trace.

## Изображения и наполнение

Seed сейчас оставляет images пустыми. Для пользовательских фотографий таблица
`product_images` принимает UUID, product_id, абсолютный HTTPS URL, alt и position.
Добавьте записи собственной SQL-миграцией или ручным D1 import. Frontend выбирает
первое изображение, показывает thumbnails остальных и fallback при ошибке URL.
Публичный CRUD не нужен для этого MVP; данные наполняются контролируемо через seed
и SQL. Загрузка файлов, storage и admin-панель намеренно не добавлены.
