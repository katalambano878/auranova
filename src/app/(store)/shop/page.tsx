import Link from "next/link";
import { Suspense } from "react";
import { parseMoney } from "@/lib/money";
import { filterOptions, listProducts, type ShopQuery } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { Filters } from "@/components/store/filters";
import { PageIntro } from "@/components/store/page-intro";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query: ShopQuery = {
    category: first(params.category),
    brand: first(params.brand),
    colour: first(params.colour),
    size: first(params.size),
    availability: first(params.availability) === "out" ? "out" : first(params.availability) === "in" ? "in" : undefined,
    min: parseMoney(first(params.min) || "") ?? undefined,
    max: parseMoney(first(params.max) || "") ?? undefined,
    sort: (first(params.sort) as ShopQuery["sort"]) || "featured",
    page: Number(first(params.page) || "1"),
    q: first(params.q),
    rating: first(params.rating) ? Number(first(params.rating)) : undefined,
  };
  const [result, options, settings] = await Promise.all([listProducts(query), filterOptions(), getSettings()]);
  const pageQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = first(value);
    if (item) pageQuery.set(key, item);
  }
  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:block"><Suspense><Filters {...options} /></Suspense></aside>
      <div>
        <details className="mb-6 rounded-[1.75rem] bg-mist p-4 lg:hidden">
          <summary>Filter and sort</summary>
          <div className="pt-4"><Suspense><Filters {...options} /></Suspense></div>
        </details>
        <PageIntro eyebrow="The catalogue" title="Shop" aside={<p className="text-sm text-stone">{result.total} products</p>} />
        {result.items.length === 0 ? (
          <div className="mt-8"><EmptyState title="Nothing matches" body="Clear a filter or search for something else." action={<Link href="/shop" className="underline">Clear filters</Link>} /></div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
            {result.items.map(({ product, current, units, onSale, compareAt }) => (
              <ProductCard
                key={product.id}
                href={`/products/${product.slug}`}
                name={product.name}
                image={product.images[0]?.url}
                alt={product.images[0]?.alt || product.name}
                currency={settings.currency}
                current={current}
                compareAt={compareAt}
                badge={product.bestseller ? "Bestseller" : onSale ? "Sale" : null}
                available={units > 0}
              />
            ))}
          </div>
        )}
        {result.pages > 1 ? (
          <nav className="mt-8 flex gap-3 text-sm" aria-label="Pagination">
            {Array.from({ length: result.pages }, (_, index) => {
              const page = index + 1;
              pageQuery.set("page", String(page));
              return <Link key={page} href={`/shop?${pageQuery.toString()}`} className={`rounded-full px-3 py-1 ${page === result.page ? "bg-forest text-white" : "bg-sage"}`}>{page}</Link>;
            })}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
