import { ShoppingPage } from '@/pages/shopping'
export const metadata = { title: 'Оплата заказа' }
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ShoppingPage screen="payment" orderId={id} />
}
