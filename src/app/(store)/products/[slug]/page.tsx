import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import { availableUnits, getProductBySlug, priceWithSettings, relatedProducts } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { catalogueImage } from "@/lib/catalogue-photos";
import { Gallery } from "@/components/store/gallery";
import { ProductCard } from "@/components/store/product-card";
import { ProductPurchase } from "@/components/store/purchase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await getProductBySlug(slug);
  if (!product) return { title: "Product" };
  return { title: product.seoTitle || product.name, description: product.seoDescription || product.shortDescription };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, redirectTo } = await getProductBySlug(slug);
  if (redirectTo) redirect(redirectTo);
  if (!product) notFound();
  const settings = await getSettings();
  const options = product.variants.map((variant) => {
    const price = priceWithSettings(settings, product, variant);
    return {
      id: variant.id,
      label: variant.label,
      current: price.current,
      compareAt: price.compareAt,
      available: availableUnits(product.trackInventory, variant.onHand, variant.reserved),
    };
  });
  const simplePrice = priceWithSettings(settings, product);
  const simple = product.variants.length ? null : {
    id: product.id,
    label: product.name,
    current: simplePrice.current,
    compareAt: simplePrice.compareAt,
    available: availableUnits(product.trackInventory, product.onHand, product.reserved),
  };
  const relatedIds = product.relationsFrom.map((relation) => relation.relatedId);
  const related = await relatedProducts(product.id, product.categoryId, relatedIds);
  const realReviews = product.reviews.filter((review) => !review.isSample);
  const average = realReviews.length ? realReviews.reduce((sum, review) => sum + review.rating, 0) / realReviews.length : null;
  const specs = product.specs && typeof product.specs === "object" && !Array.isArray(product.specs) ? product.specs as Record<string, string> : {};
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.shortDescription,
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      priceCurrency: settings.currency,
      price: ((simple?.current ?? options[0]?.current ?? product.price) / 100).toFixed(2),
      availability: (simple?.available ?? options.some((option) => option.available > 0)) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="text-sm text-stone"><Link href="/shop">Shop</Link> / <Link href={`/categories/${product.category.slug}`}>{product.category.name}</Link></p>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <Gallery images={product.images.map((image, index) => ({ url: index === 0 ? catalogueImage(product.slug, image.url) || image.url : image.url, alt: image.alt || product.name }))} />
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-leaf">{product.brand?.name || product.category.name}</p>
          <h1 className="mt-2 font-serif text-5xl text-ink">{product.name}</h1>
          <p className="mt-3 text-stone">{product.shortDescription}</p>
          <p className="mt-2 text-sm text-stone">SKU {product.sku}</p>
          {average ? <p className="mt-2 text-sm">{average.toFixed(1)} from {realReviews.length} published reviews</p> : null}
          <ProductPurchase productId={product.id} currency={settings.currency} options={options} simple={simple} />
          <div className="mt-8 space-y-2 text-sm text-stone">
            <p>Delivery fees are calculated at checkout from your region.</p>
            <p>Returns follow the policy published on the returns page.</p>
          </div>
        </div>
      </div>
      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-[2rem] bg-mist p-8">
          <h2 className="font-serif text-3xl">Description</h2>
          <div className="prose-store" dangerouslySetInnerHTML={{ __html: renderMarkdown(product.description) }} />
          {product.features.length ? <ul className="mt-4 list-disc pl-5">{product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : null}
        </div>
        <div className="rounded-[2rem] border border-line bg-white p-8">
          <h2 className="font-serif text-3xl">Specifications</h2>
          <dl className="mt-4">
            {Object.entries(specs).map(([key, value]) => <div key={key} className="grid grid-cols-2 border-b border-line py-2 text-sm"><dt className="text-stone">{key}</dt><dd>{value}</dd></div>)}
          </dl>
        </div>
      </section>
      <section className="mt-14">
        <h2 className="font-serif text-3xl">Reviews</h2>
        {product.reviews.length === 0 ? <p className="mt-3 text-stone">No published reviews yet.</p> : (
          <ul className="mt-4 space-y-4">
            {product.reviews.map((review) => (
              <li key={review.id} className="rounded-[1.5rem] bg-mist p-5">
                <p>{review.body}</p>
                <p className="mt-2 text-sm text-stone">{review.authorName} · {review.rating}/5 {review.isSample ? "· Sample, not a verified purchase" : review.verifiedPurchase ? "· Verified purchase" : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {related.length ? (
        <section className="mt-14">
          <h2 className="font-serif text-3xl">Related</h2>
          <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {related.map((item) => {
              const price = priceWithSettings(settings, item, item.variants[0]);
              const units = item.variants.length
                ? item.variants.reduce((sum, variant) => sum + availableUnits(item.trackInventory, variant.onHand, variant.reserved), 0)
                : availableUnits(item.trackInventory, item.onHand, item.reserved);
              return <ProductCard key={item.id} href={`/products/${item.slug}`} name={item.name} image={item.images[0]?.url} alt={item.images[0]?.alt || item.name} currency={settings.currency} current={price.current} compareAt={price.compareAt} available={units > 0} />;
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
