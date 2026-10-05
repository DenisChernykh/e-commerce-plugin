import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SearchForm } from './search-form'

describe('catalog search', () => {
  it('submits a trimmed query and clears both input and applied query', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<SearchForm onSearch={onSearch} />)
    await user.type(
      screen.getByRole('textbox', { name: 'Поиск по каталогу' }),
      '  кедр  ',
    )
    await user.click(screen.getByRole('button', { name: 'Найти' }))
    expect(onSearch).toHaveBeenLastCalledWith('кедр')
    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }))
    expect(onSearch).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })
})
