import { Container } from '@/shared/ui/container'
import { Skeleton } from '@/shared/ui/skeleton'

export default function Loading() {
  return (
    <Container className="py-12" aria-label="Загрузка страницы">
      <Skeleton className="mb-10 h-20 max-w-xl" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </Container>
  )
}
