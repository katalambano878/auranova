import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { supabaseAdmin, throwIf } from "@/server/db";
import { availableUnits, priceWithSettings, productEmbed } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { CategoryStage } from "@/components/store/category-stage";
import { FeaturedShelf } from "@/components/store/featured-shelf";
import { HeroSlider } from "@/components/store/hero-slider";
import { NewsletterForm } from "@/components/store/newsletter";
import { cataloguePhotos } from "@/lib/catalogue-photos";

const heroSlides = [
  { src: "/hero/slide-1.jpg", alt: "Home and living products from the AuraNova catalogue" },
  { src: "/hero/slide-2.jpg", alt: "Electronics and appliances from the AuraNova catalogue" },
  { src: "/hero/slide-3.jpg", alt: "Beauty and accessories from the AuraNova catalogue" },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getSettings();
  const db = supabaseAdmin();
  const [categoriesRes, featuredRes, featuredProductsRes, promotionRes] = await Promise.all([
    db.from("Category").select("*").is("deletedAt", null).order("position"),
    db.from("Product").select("*, images:ProductImage(url, alt, position)").eq("status", "PUBLISHED").is("deletedAt", null).order("featured", { ascending: false }).order("createdAt", { ascending: false }).limit(6),
    db.from("Product").select(productEmbed).eq("status", "PUBLISHED").is("deletedAt", null).eq("featured", true).order("createdAt", { ascending: false }).limit(4),
    db.from("Promotion").select("*").eq("active", true).order("position").limit(1).maybeSingle(),
  ]);
  throwIf(categoriesRes.error);
  throwIf(featuredRes.error);
  throwIf(featuredProductsRes.error);
  throwIf(promotionRes.error);
  const categoriesRaw = categoriesRes.data || [];
  const categories = await Promise.all(
    categoriesRaw.map(async (category) => {
      const { count, error } = await db.from("Product").select("id", { count: "exact", head: true }).eq("categoryId", category.id).eq("status", "PUBLISHED").is("deletedAt", null);
      throwIf(error);
      return { ...category, _count: { products: count ?? 0 } };
    }),
  );
  const featured = (featuredRes.data || []).map((product) => ({
    ...product,
    images: [...(product.images || [])].sort((a, b) => a.position - b.position).slice(0, 1),
  }));
  const featuredProducts = featuredProductsRes.data || [];
  const promotion = promotionRes.data;
  const pictures = featured.map((product) => product.images[0]?.url).filter((url): url is string => Boolean(url));
  const title = splitTitle(settings.heroTitle);
  return (
    <main>
      <section className="relative min-h-[36rem] w-full overflow-hidden md:min-h-[42rem]">
        <HeroSlider images={heroSlides} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        <div className="relative z-10 mx-auto flex min-h-[36rem] max-w-7xl items-center px-4 py-16 md:min-h-[42rem] md:px-8">
          <div>
            <h1 className="max-w-xl font-serif text-5xl leading-[1.08] text-white md:text-6xl">
              {title.lead}{title.accent ? <> <span className="text-sage">{title.accent}</span></> : null}
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-white/85">{settings.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={settings.heroCtaHref} className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm text-white">{settings.heroCtaLabel} <ArrowRight className="h-4 w-4" /></Link>
              {settings.heroSecondaryHref && settings.heroSecondaryLabel ? (
                <Link href={settings.heroSecondaryHref} className="inline-flex items-center gap-2 rounded-full border border-white bg-white/10 px-6 py-3 text-sm text-white">{settings.heroSecondaryLabel} <ArrowRight className="h-4 w-4" /></Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <CategoryStage
        categories={categories.map((category) => ({
          name: category.name,
          slug: category.slug,
          image: category.imageUrl || "/demo/hero.svg",
          count: category._count.products,
          description: category.description,
        }))}
      />

      <FeaturedShelf
        items={featuredProducts.map((product) => {
          const variant = product.variants[0];
          const price = priceWithSettings(settings, product, variant);
          const units = product.variants.length
            ? product.variants.reduce((sum: any, item: any) => sum + availableUnits(product.trackInventory, item.onHand, item.reserved), 0)
            : availableUnits(product.trackInventory, product.onHand, product.reserved);
          return {
            href: `/products/${product.slug}`,
            name: product.name,
            image: cataloguePhotos[product.slug] || product.images[0]?.url,
            alt: product.images[0]?.alt || product.name,
            currency: settings.currency,
            current: price.current,
            compareAt: price.compareAt,
            note: product.bestseller ? "Bestseller" : price.onSale ? "On sale" : null,
            available: units > 0,
          };
        })}
      />

      <section className="mx-auto grid max-w-7xl gap-5 px-4 md:grid-cols-2">
        <PromoCard
          tone="sage"
          kicker={promotion ? "Current offer" : "In the catalogue"}
          title={promotion?.title || "Special offers"}
          body={promotion?.subtitle || "Sale prices are the ones saved on each product."}
          href={promotion?.ctaHref || "/shop"}
          label={promotion?.ctaLabel || "Shop now"}
          image={pictures[1] || pictures[0]}
        />
        <PromoCard
          tone="forest"
          kicker="Across Ghana"
          title="Delivery from Accra to every region"
          body="Fees come from the shipping method saved for the region you choose."
          href="/shipping"
          label="Shipping details"
          image={pictures[2] || pictures[0]}
        />
      </section>

      <section className="bg-white px-4 pb-20 pt-8">
        <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-[2rem] border border-line bg-mist px-6 py-10 md:grid-cols-[1fr_1.1fr] md:px-12 md:py-14">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-leaf">Newsletter</p>
            <h2 className="mt-2 font-serif text-4xl text-ink md:text-5xl">Notes from the shop</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone">We only confirm an address that is actually saved.</p>
          </div>
          <NewsletterForm />
        </div>
      </section>
    </main>
  );
}

function splitTitle(title: string) {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return { lead: title, accent: "" };
  const accent = words.pop() || "";
  return { lead: words.join(" "), accent };
}

function PromoCard({
  tone,
  kicker,
  title,
  body,
  href,
  label,
  image,
}: {
  tone: "sage" | "forest";
  kicker: string;
  title: string;
  body: string;
  href: string;
  label: string;
  image?: string;
}) {
  const dark = tone === "forest";
  return (
    <article className={`grid overflow-hidden rounded-3xl md:grid-cols-[1.1fr_0.9fr] ${dark ? "bg-forest text-white" : "bg-sage text-ink"}`}>
      <div className="p-8">
        <p className={`text-sm ${dark ? "text-white/70" : "text-leaf"}`}>{kicker}</p>
        <h2 className="mt-2 max-w-xs font-serif text-4xl leading-tight">{title}</h2>
        <p className={`mt-3 max-w-xs text-sm ${dark ? "text-white/80" : "text-stone"}`}>{body}</p>
        <Link href={href} className={`mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm ${dark ? "bg-white text-forest" : "bg-forest text-white"}`}>
          {label} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {image ? <img src={image} alt="" className="h-52 w-full object-cover object-top md:h-full" /> : null}
    </article>
  );
}
