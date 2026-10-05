'use client'

import { Search, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

export function SearchForm({
  value,
  onSearch,
}: {
  value?: string
  onSearch: (value?: string) => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  return (
    <form
      role="search"
      className="flex h-12 items-center gap-2 border-b border-foreground/40"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch(draft.trim() || undefined)
      }}
    >
      <Search
        className="ml-1 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="search"
        aria-label="Поиск по каталогу"
        placeholder="Название, аромат, материал или бренд"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={160}
        className="h-11 border-0 px-2 text-sm shadow-none focus-visible:ring-0"
      />
      {draft.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Очистить поиск"
          onClick={() => {
            setDraft('')
            onSearch(undefined)
          }}
        >
          <X className="size-4" />
        </Button>
      )}
      <Button type="submit" variant="ghost" className="h-10 px-4">
        Найти
      </Button>
    </form>
  )
}
