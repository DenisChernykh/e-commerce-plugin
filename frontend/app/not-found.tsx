import Link from 'next/link'

import { buttonVariants } from '@/shared/ui/button'
import { Container } from '@/shared/ui/container'
import { EmptyState } from '@/shared/ui/empty-state'

export default function NotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        title="Здесь пока тихо"
        description="Такой страницы или предмета нет. В каталоге найдётся что-нибудь близкое вам."
        action={
          <Link href="/catalog" className={buttonVariants()}>
            Перейти в каталог
          </Link>
        }
      />
    </Container>
  )
}
