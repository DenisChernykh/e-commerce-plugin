import { Leaf } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center border border-dashed p-8 text-center">
      <Leaf
        className="mb-5 size-8 text-muted-foreground"
        strokeWidth={1}
        aria-hidden
      />
      <h2 className="font-serif text-3xl">{title}</h2>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {Boolean(action) && <div className="mt-6">{action}</div>}
    </div>
  )
}
