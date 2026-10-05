import { ArrowRight, ArrowUpRight, Leaf, Minus, Sparkles } from 'lucide-react'
import Link from 'next/link'

import {
  loadCategories,
  loadFeaturedProducts,
  ProductCard,
} from '@/entities/product'
import { routes } from '@/shared/routes'
import { buttonVariants } from '@/shared/ui/button'
import { Container } from '@/shared/ui/container'
import { ObjectArt } from '@/shared/ui/object-art'

export async function HomePage() {
  const [featured, categories] = await Promise.all([
    loadFeaturedProducts(),
    loadCategories(),
  ])
  return (
    <>
      <Container className="pt-6 md:pt-9">
        <section className="grid overflow-hidden bg-secondary/50 md:min-h-[580px] md:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col items-start justify-center px-7 py-14 md:px-12 lg:px-16">
            <p className="eyebrow mb-7 flex items-center gap-3">
              <span className="h-px w-6 bg-primary" />
              Пространство для себя
            </p>
            <h1 className="font-serif text-[64px] leading-[0.98] tracking-[-0.035em] lg:text-[88px]">
              Искусство
              <br />
              быть <span className="italic">дома.</span>
            </h1>
            <p className="mt-7 max-w-xs text-[13px] leading-7 text-muted-foreground">
              Предметы с характером для ваших ежедневных ритуалов. Тёплый свет,
              живые фактуры и красота в простом.
            </p>
            <Link
              href={routes.catalog}
              className={`${buttonVariants()} mt-9 h-12 gap-7 px-6 text-xs`}
            >
              Открыть коллекцию <ArrowRight className="size-4" />
            </Link>
            <p className="mt-9 text-[10px] tracking-[0.08em] text-muted-foreground">
              Выбрано с вниманием к каждой детали
            </p>
          </div>
          <div className="relative min-h-96 overflow-hidden bg-[#e8e4db]">
            <div className="absolute top-12 left-12 h-[65%] w-[60%] rounded-t-full bg-[#e1ddd2]" />
            <ObjectArt
              category="decor"
              scene
              color="#c4b198"
              className="absolute -top-[18%] -left-[12%] h-[105%] w-[105%] mix-blend-multiply"
            />
            <ObjectArt
              category="candles"
              scene
              color="#a6a58d"
              className="absolute -right-[10%] bottom-[-4%] h-[62%] w-[62%] mix-blend-multiply"
            />
            <div className="absolute right-7 bottom-7 left-7 flex items-end justify-between">
              <span className="text-[9px] tracking-[0.18em] text-primary/70 uppercase">
                The everyday collection
              </span>
              <span className="font-serif text-4xl text-primary/70">01</span>
            </div>
          </div>
        </section>
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 border-b py-7 text-[10px] tracking-wide text-muted-foreground md:justify-between">
          <span className="flex items-center gap-2">
            <Leaf className="size-3.5" />
            Натуральные фактуры
          </span>
          <span className="flex items-center gap-2">
            <Minus className="size-3.5" />
            Спокойные формы
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="size-3.5" />
            Маленькие повседневные ритуалы
          </span>
        </div>

        <section
          className="py-16 md:py-24"
          aria-labelledby="categories-heading"
        >
          <div className="mb-9 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-4 text-muted-foreground">Найдите своё</p>
              <h2 id="categories-heading" className="section-title">
                У каждого дома свой характер
              </h2>
            </div>
            <Link
              href={routes.categories}
              className="hidden items-center gap-3 pb-2 text-xs md:flex"
            >
              Все категории
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.items.map((category, index) => (
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
                  className="aspect-[4/4.5] w-full"
                />
                <div className="mt-4 flex items-center justify-between">
                  <h3 className="text-xs">{category.name}</h3>
                  <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="featured-heading">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow mb-4 text-muted-foreground">
                Наша тихая рекомендация
              </p>
              <h2 id="featured-heading" className="section-title">
                Особенно любим
              </h2>
            </div>
            <Link
              href="/catalog?featured=true"
              className="flex items-center gap-3 border-b border-foreground/40 pb-2 text-xs"
            >
              Вся подборка
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
            {featured.items.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section
          id="philosophy"
          className="mt-20 grid scroll-mt-8 md:mt-28 md:grid-cols-2"
          aria-labelledby="philosophy-heading"
        >
          <div className="relative overflow-hidden bg-[#e7e4dc]">
            <ObjectArt
              category="textiles"
              color="#a2a58c"
              className="aspect-square w-full mix-blend-multiply"
            />
            <span className="eyebrow absolute top-8 left-8 text-primary/60">
              Чувствовать, а не спешить
            </span>
          </div>
          <div className="flex flex-col items-start justify-center bg-[#e9ebdf] px-8 py-14 md:px-14">
            <p className="eyebrow mb-6 text-muted-foreground">Философия TIHO</p>
            <h2 id="philosophy-heading" className="section-title max-w-sm">
              Дом — это
              <br />
              не место.
              <br />
              <span className="italic">Это ощущение.</span>
            </h2>
            <p className="mt-7 max-w-sm text-sm leading-7 text-muted-foreground">
              Любимая чашка в ладонях. Свет свечи после длинного дня. Мягкость
              пледа на плечах. Мы собираем вещи, которые помогают замечать такие
              моменты.
            </p>
            <Link
              href={routes.catalog}
              className="mt-8 flex items-center gap-8 border-b border-foreground/40 pb-2 text-xs"
            >
              Найти свою вещь
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </Container>
    </>
  )
}
