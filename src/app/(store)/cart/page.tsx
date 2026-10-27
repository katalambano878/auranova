import Link from "next/link";
import { cookies } from "next/headers";
import { cartView } from "@/server/cart";
import { getSettings } from "@/server/settings";
import { catalogueImage } from "@/lib/catalogue-photos";
import { CartEditor } from "@/components/store/cart-editor";
import { PageIntro } from "@/components/store/page-intro";
import { EmptyState } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [cart, settings, jar] = await Promise.all([cartView(), getSettings(), cookies()]);
  const coupon = jar.get("auranova_coupon")?.value;
  if (!cart.items.length) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16">
        <PageIntro eyebrow="Checkout" title="Bag" />
        <div className="mt-8"><EmptyState title="Your bag is empty" body="The catalogue is ready when you are." action={<Link href="/shop" className="underline">Continue shopping</Link>} /></div>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <PageIntro eyebrow="Checkout" title="Bag" />
      {coupon ? <p className="mt-2 text-sm text-stone">Coupon {coupon} will be checked at checkout.</p> : null}
      <div className="mt-8">
        <CartEditor currency={settings.currency} items={cart.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          variant: item.variant?.label ?? null,
          image: catalogueImage(item.product.slug, item.product.images[0]?.url) || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          problem: item.problem,
        }))} />
      </div>
      <p className="mt-6"><Link href="/shop" className="text-sm underline">Continue shopping</Link></p>
    </main>
  );
}
