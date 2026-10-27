import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export type StageCategory = {
  name: string;
  slug: string;
  image: string;
  count: number;
  description: string;
};

export function CategoryStage({ categories }: { categories: StageCategory[] }) {
  const [lead, ...rest] = categories;
  if (!lead) return null;

  return (
    <section className="bg-mist" aria-labelledby="category-stage-title">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-leaf">Browse</p>
            <h2 id="category-stage-title" className="mt-2 font-serif text-5xl text-ink">Shop by category</h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-stone">
            {categories.length} rooms in the catalogue. Counts are the published pieces in each one.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Link
            href={`/categories/${lead.slug}`}
            className="group relative flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-[2rem] bg-forest p-8 text-white md:col-span-2 md:row-span-2 md:min-h-[32rem]"
          >
            <span className="pointer-events-none absolute -right-6 -top-10 font-serif text-[14rem] leading-none text-white/10" aria-hidden="true">
              {lead.name.slice(0, 1)}
            </span>
            <span className="relative text-xs uppercase tracking-[0.2em] text-sage">{pieceLabel(lead.count)}</span>
            <span className="relative">
              <span className="block font-serif text-6xl leading-none">{lead.name}</span>
              {lead.description ? <span className="mt-4 block max-w-sm text-sm leading-relaxed text-white/75">{lead.description}</span> : null}
              <span className="mt-6 inline-flex items-center gap-2 text-sm">
                Open {lead.name} <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </span>
          </Link>
          {rest.map((category) => (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="group flex min-h-48 flex-col justify-between rounded-[2rem] bg-white p-6 text-ink transition duration-300 hover:-translate-y-1"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-sage font-serif text-xl text-forest">
                {category.name.slice(0, 1)}
              </span>
              <span>
                <span className="block font-serif text-3xl leading-none">{category.name}</span>
                <span className="mt-2 flex items-center justify-between text-sm text-stone">
                  {pieceLabel(category.count)}
                  <ArrowUpRight className="h-4 w-4 text-forest opacity-0 transition group-hover:opacity-100" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function pieceLabel(count: number) {
  return `${count} ${count === 1 ? "piece" : "pieces"}`;
}
