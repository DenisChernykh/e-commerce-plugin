'use client'

import { Button } from '@/shared/ui/button'
import { Container } from '@/shared/ui/container'
import { EmptyState } from '@/shared/ui/empty-state'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Container className="py-16">
      <EmptyState
        title="Нужна небольшая пауза"
        description="Не получилось загрузить страницу. Проверьте соединение и попробуйте ещё раз."
        action={<Button onClick={reset}>Попробовать снова</Button>}
      />
    </Container>
  )
}
