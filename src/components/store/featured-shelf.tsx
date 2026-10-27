import Link from "next/link";
import { formatMoney } from "@/lib/money";

export type FeaturedItem = {
  href: string;
  name: string;
  image?: string | null;
  alt: string;
  currency: string;
  current: number;
  compareAt: number | null;
  note: string | null;
  available: boolean;
};

export function FeaturedShelf({ items }: { items: FeaturedItem[] }) {
  if (!items.length) return null;

  return (
    <section className="bg-white" aria-labelledby="featured-title">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-leaf">Selected</p>
            <h2 id="featured-title" className="mt-2 font-serif text-5xl text-ink">Featured</h2>
          </div>
          <Link href="/shop" className="text-sm text-forest">View the shop</Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.href}>
              <Link href={item.href} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-mist">
                  {item.image ? <img src={item.image} alt={item.alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : null}
                  {item.note ? <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-forest">{item.note}</span> : null}
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <h3 className="font-serif text-2xl leading-tight text-ink">{item.name}</h3>
                  <p className="shrink-0 text-right text-sm text-ink">
                    <span className="block">{formatMoney(item.current, item.currency)}</span>
                    {item.compareAt ? <span className="text-stone line-through">{formatMoney(item.compareAt, item.currency)}</span> : null}
                  </p>
                </div>
                <p className="mt-1 text-sm text-stone">{item.available ? "In stock" : "Out of stock"}</p>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
