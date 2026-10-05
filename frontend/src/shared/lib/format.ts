const formatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function formatPrice(price: number) {
  return formatter.format(price)
}

export function productCount(count: number) {
  const form = new Intl.PluralRules('ru-RU').select(count)
  const noun =
    form === 'one' ? 'предмет' : form === 'few' ? 'предмета' : 'предметов'
  return `${count} ${noun}`
}
