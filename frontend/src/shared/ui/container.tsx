import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

export function Container({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1440px] px-5 md:px-10 lg:px-16',
        className,
      )}
      {...props}
    />
  )
}
