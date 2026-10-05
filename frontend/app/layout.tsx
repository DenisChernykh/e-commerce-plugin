import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { QueryProvider } from '@/app/config/query-provider'
import '@/app/styles/index.css'
import { StoreShell } from '@/widgets/store-shell'

export const metadata: Metadata = {
  title: { default: 'TIHO — искусство быть дома', template: '%s · TIHO' },
  description:
    'Предметы с характером для ваших ежедневных ритуалов: свечи, керамика, текстиль и декор для дома.',
  icons: { icon: '/icon.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <QueryProvider>
          <StoreShell>{children}</StoreShell>
        </QueryProvider>
      </body>
    </html>
  )
}
