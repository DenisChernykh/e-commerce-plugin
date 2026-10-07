'use client'

import { ArrowUpRight, Check, Copy, Download, Plug } from 'lucide-react'
import { useState } from 'react'
import { tihoPlugin } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Container } from '@/shared/ui/container'

export function PluginsPage() {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(tihoPlugin.mcpUrl)
      setCopied(true)
      setCopyFailed(false)
    } catch {
      setCopyFailed(true)
      setCopied(false)
    }
  }
  return (
    <Container className="max-w-4xl py-12 md:py-16">
      <p className="eyebrow mb-4">TIHO рядом с разговором</p>
      <h1 className="display-title">Плагины</h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
        Подбирайте предметы для дома обычными фразами. ChatGPT обращается к
        нашему каталогу, учитывает ваши условия и помогает сравнить варианты.
      </p>
      <section
        className="mt-10 border bg-card p-6 sm:p-8"
        aria-labelledby="chatgpt-plugin-title"
      >
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center bg-secondary">
            <Plug className="size-6" strokeWidth={1.5} />
          </span>
          <div>
            <h2 id="chatgpt-plugin-title" className="font-serif text-3xl">
              TIHO для ChatGPT
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Поиск · сравнение · корзина · заказы
            </p>
          </div>
        </div>
        <p className="mt-6 text-sm leading-7">
          Откройте каталог с карточками, найдите предметы по материалу, цвету,
          цене и характеристикам. Продолжайте подборку в разговоре: «Теперь
          только в наличии», «Покажи ещё», «Сравни первый и третий». Добавляйте
          выбранные предметы в корзину, проверяйте состав и оформляйте заказ.
        </p>
        <h3 className="mt-8 text-sm font-semibold">Как подключить</h3>
        <a
          href={tihoPlugin.pluginUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-10 items-center gap-2 bg-primary px-4 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Открыть плагин в ChatGPT <ArrowUpRight className="size-4" />
        </a>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6">
          <li>
            В ChatGPT откройте «Плагины» → «Личные» → «Созданные вами» → TIHO.
          </li>
          <li>
            Нажмите «Установить» и «Подключить», если ChatGPT предлагает эти
            действия. Доступ к личному плагину зависит от аккаунта ChatGPT.
          </li>
          <li>
            Выберите TIHO в разговоре и попросите: «Покажи свечи до 3000 ₽,
            сначала дешевле».
          </li>
        </ol>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          Этот раздел не получает статус установки из вашего аккаунта ChatGPT.
          Установка и подключение подтверждаются в самом ChatGPT.
        </p>
        <div className="mt-7 border-t pt-6">
          <label
            htmlFor="tiho-mcp-url"
            className="mb-2 block text-xs font-medium"
          >
            Адрес MCP для подключения
          </label>
          <input
            id="tiho-mcp-url"
            readOnly
            value={tihoPlugin.mcpUrl}
            className="w-full border bg-background p-3 text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void copy()}>
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? 'Скопировано' : 'Скопировать адрес'}
            </Button>
            <a
              href={tihoPlugin.packageUrl}
              download
              className="inline-flex h-10 items-center gap-2 border px-4 text-xs transition-colors hover:bg-accent"
            >
              <Download className="size-4" />
              Скачать пакет плагина
            </a>
            <a
              href={tihoPlugin.documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 px-2 text-xs underline underline-offset-4"
            >
              Инструкция ChatGPT
              <ArrowUpRight className="size-4" />
            </a>
          </div>
          {copied && (
            <p role="status" className="mt-3 text-xs">
              Адрес MCP скопирован.
            </p>
          )}
          {copyFailed && (
            <p role="alert" className="mt-3 text-xs">
              Браузер не разрешил копирование. Адрес можно выделить в поле выше.
            </p>
          )}
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Пакет содержит описание, настройки MCP и навык подбора. В режиме
            разработчика ChatGPT можно подключить MCP по адресу согласно
            официальной инструкции. Доступ к приватному плагину подтверждается
            через ChatGPT; отдельный ключ магазина не требуется.
          </p>
        </div>
      </section>
      <section className="mt-10" aria-labelledby="plugin-examples">
        <h2 id="plugin-examples" className="font-serif text-3xl">
          Попробуйте в разговоре
        </h2>
        <ul className="mt-5 space-y-3 text-sm leading-7">
          <li>«Покажи соевые свечи до 3000 ₽ в наличии, сначала дешевле».</li>
          <li>
            «Найди свечи с древесным ароматом. Сравни первый и третий варианты».
          </li>
          <li>«Оставь бежевые предметы, затем убери ограничение по цвету».</li>
          <li>«Открой второй вариант. Вернись к предыдущей подборке».</li>
          <li>«Добавь второй вариант, две штуки. Покажи корзину».</li>
          <li>«Оформи заказ. Перейти к оплате. Оплатить».</li>
          <li>«Покажи мой заказ».</li>
        </ul>
      </section>
    </Container>
  )
}
