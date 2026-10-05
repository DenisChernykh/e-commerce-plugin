import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

import { loadCategories } from '@/entities/product'
import { routes } from '@/shared/routes'
import { Container } from '@/shared/ui/container'
import { ObjectArt } from '@/shared/ui/object-art'

export async function CategoriesPage() {
  const { items } = await loadCategories()
  return (
    <Container className="pt-12 md:pt-16">
      <p className="eyebrow mb-5 text-muted-foreground">
        Шесть способов добавить уюта
      </p>
      <h1 className="display-title">
        Маленькие миры
        <br />
        <span className="italic">вашего дома</span>
      </h1>
      <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
        От первой чашки кофе до последней свечи вечером. Выберите то, с чего
        начнётся ваш ритуал.
      </p>
      <div className="mt-12 grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((category, index) => (
          <Link
            key={category.id}
            href={routes.category(category.slug)}
            className="group"
          >
            <ObjectArt
              category={category.slug}
              color={
                [
                  '#c4b39b',
                  '#927c62',
                  '#c2c0ac',
                  '#9c9e82',
                  '#b89b72',
                  '#c7b39e',
                ][index]
              }
              className="aspect-[5/4] w-full"
            />
            <div className="mt-5 flex items-center justify-between">
              <h2 className="font-serif text-3xl">{category.name}</h2>
              <ArrowUpRight className="size-5" strokeWidth={1} />
            </div>
            <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
              {category.description}
            </p>
          </Link>
        ))}
      </div>
    </Container>
  )
}
