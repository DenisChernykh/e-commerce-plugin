export const routes = {
  home: '/',
  catalog: '/catalog',
  categories: '/categories',
  plugins: '/plugins',
  product: (slug: string) => `/products/${encodeURIComponent(slug)}`,
  category: (slug: string) => `/catalog?category=${encodeURIComponent(slug)}`,
}
