import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProducts } from "@/server/catalog";
import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";
import { PageIntro } from "@/components/store/page-intro";
import { ProductCard } from "@/components/store/product-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  return { title: category?.name || "Category", description: category?.description };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await prisma.category.findFirst({ where: { slug, deletedAt: null } });
  if (!category) notFound();
  const [result, settings] = await Promise.all([listProducts({ category: slug }), getSettings()]);
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Category" title={category.name} body={category.description} />
      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {result.items.map(({ product, current, compareAt, units }) => (
          <ProductCard key={product.id} href={`/products/${product.slug}`} name={product.name} image={product.images[0]?.url} alt={product.images[0]?.alt || product.name} currency={settings.currency} current={current} compareAt={compareAt} available={units > 0} />
        ))}
      </div>
    </main>
  );
}
