import { listProducts } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { PageIntro } from "@/components/store/page-intro";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [result, settings] = await Promise.all([q.trim() ? listProducts({ q: q.trim() }) : Promise.resolve(null), getSettings()]);
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="The catalogue" title="Search" />
      <form className="mt-6 flex gap-2">
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={q} className="w-full rounded-full border border-line bg-white px-4 py-2" />
        <button className="rounded-full bg-forest px-5 text-white">Search</button>
      </form>
      {!q.trim() ? <p className="mt-6 text-stone">Search names, SKUs, brands, and descriptions.</p> : null}
      {result && result.items.length === 0 ? <div className="mt-8"><EmptyState title="No results" body={`Nothing matched “${q}”.`} /></div> : null}
      {result ? (
        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {result.items.map(({ product, current, compareAt, units }) => (
            <ProductCard key={product.id} href={`/products/${product.slug}`} name={product.name} image={product.images[0]?.url} alt={product.images[0]?.alt || product.name} currency={settings.currency} current={current} compareAt={compareAt} available={units > 0} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
