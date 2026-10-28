import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { availableUnits, priceWithSettings, productEmbed } from "@/server/catalog";
import { supabaseAdmin, throwIf } from "@/server/db";
import { getSettings } from "@/server/settings";
import { PageIntro } from "@/components/store/page-intro";
import { ProductCard } from "@/components/store/product-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data: collection, error } = await supabaseAdmin().from("Collection").select("name, description").eq("slug", slug).maybeSingle();
  throwIf(error);
  return { title: collection?.name || "Collection", description: collection?.description };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: collection, error } = await supabaseAdmin()
    .from("Collection")
    .select(`*, products:CollectionProduct(position, product:Product(${productEmbed}))`)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  throwIf(error);
  if (!collection) notFound();
  const settings = await getSettings();
  const products = [...(collection.products || [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.product)
    .filter((product) => product && product.status === "PUBLISHED" && !product.deletedAt);
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Collection" title={collection.name} body={collection.description} />
      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {products.map((product) => {
          const price = priceWithSettings(settings, product, product.variants?.[0]);
          const units = product.variants?.length
            ? product.variants.reduce((sum: any, variant: any) => sum + availableUnits(product.trackInventory, variant.onHand, variant.reserved), 0)
            : availableUnits(product.trackInventory, product.onHand, product.reserved);
          return <ProductCard key={product.id} href={`/products/${product.slug}`} name={product.name} image={product.images?.[0]?.url} alt={product.images?.[0]?.alt || product.name} currency={settings.currency} current={price.current} compareAt={price.compareAt} available={units > 0} />;
        })}
      </div>
    </main>
  );
}
