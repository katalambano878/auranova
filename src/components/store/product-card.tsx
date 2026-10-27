import Link from "next/link";
import { catalogueImage } from "@/lib/catalogue-photos";
import { formatMoney } from "@/lib/money";

export function Price({ currency, current, compareAt }: { currency: string; current: number; compareAt: number | null }) {
  return (
    <p className="text-sm text-ink">
      <span>{formatMoney(current, currency)}</span>
      {compareAt ? <span className="ml-2 text-stone line-through">{formatMoney(compareAt, currency)}</span> : null}
    </p>
  );
}

export function ProductCard({
  href,
  name,
  image,
  alt,
  currency,
  current,
  compareAt,
  badge,
  available,
}: {
  href: string;
  name: string;
  image?: string | null;
  alt: string;
  currency: string;
  current: number;
  compareAt: number | null;
  badge?: string | null;
  available: boolean;
}) {
  const src = catalogueImage(href.split("/").pop(), image);
  const demo = Boolean(src?.startsWith("/demo/"));
  return (
    <article>
      <Link href={href} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-mist">
          {src ? (
            <img
              src={src}
              alt={alt}
              className={demo
                ? "absolute inset-0 h-full w-full scale-[2.2] object-cover object-[center_40%]"
                : "h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"}
            />
          ) : null}
          {badge ? <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-forest">{badge}</span> : null}
        </div>
        <div className="mt-4 sm:flex sm:items-start sm:justify-between sm:gap-3">
          <h3 className="font-serif text-xl leading-tight text-ink lg:text-2xl">{name}</h3>
          <div className="mt-1 shrink-0 sm:mt-0 sm:text-right"><Price currency={currency} current={current} compareAt={compareAt} /></div>
        </div>
        <p className="mt-1 text-sm text-stone">{available ? "In stock" : "Out of stock"}</p>
      </Link>
    </article>
  );
}
