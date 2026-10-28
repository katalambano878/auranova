import Link from "next/link";
import { availableUnits, priceWithSettings, productEmbed } from "@/server/catalog";
import { supabaseAdmin, throwIf } from "@/server/db";
import { getSession } from "@/server/session";
import { getSettings } from "@/server/settings";
import { PageIntro } from "@/components/store/page-intro";
import { ProductCard } from "@/components/store/product-card";
import { GuestWishlist } from "@/components/store/guest-wishlist";

export const dynamic = "force-dynamic";

type WishlistProduct = {
  id: string;
  slug: string;
  name: string;
  status: string;
  deletedAt: string | null;
  trackInventory: boolean;
  onHand: number;
  reserved: number;
  price: number;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  images: { url: string; alt: string | null }[];
  variants: { onHand: number; reserved: number; price: number; salePrice: number | null }[];
};

export default async function WishlistPage() {
  const session = await getSession();
  if (!session) return <main className="mx-auto max-w-7xl px-4 py-16"><PageIntro eyebrow="Account" title="Saved" /><div className="mt-8"><GuestWishlist /></div></main>;
  const { data: items, error } = await supabaseAdmin()
    .from("WishlistItem")
    .select(`product:Product(${productEmbed})`)
    .eq("userId", session.user.id);
  throwIf(error);
  const settings = await getSettings();
  const products = (items || [])
    .map((item) => {
      const product = item.product as WishlistProduct | WishlistProduct[] | null;
      return Array.isArray(product) ? product[0] : product;
    })
    .filter((product): product is WishlistProduct => Boolean(product && product.status === "PUBLISHED" && !product.deletedAt));
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Saved" />
      {products.length === 0 ? <p className="mt-4 text-stone">Nothing saved yet. <Link href="/shop" className="underline">Browse the shop</Link></p> : (
        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {products.map((product) => {
            const price = priceWithSettings(settings, product, product.variants?.[0]);
            const units = product.variants?.length
              ? product.variants.reduce((sum, variant) => sum + availableUnits(product.trackInventory, variant.onHand, variant.reserved), 0)
              : availableUnits(product.trackInventory, product.onHand, product.reserved);
            return <ProductCard key={product.id} href={`/products/${product.slug}`} name={product.name} image={product.images?.[0]?.url} alt={product.images?.[0]?.alt || product.name} currency={settings.currency} current={price.current} compareAt={price.compareAt} available={units > 0} />;
          })}
        </div>
      )}
    </main>
  );
}
