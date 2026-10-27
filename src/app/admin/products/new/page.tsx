import { prisma } from "@/server/db";
import { ProductEditor } from "@/components/admin/product-editor";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">New product</h1>
      <div className="mt-6"><ProductEditor categories={categories} brands={brands} /></div>
    </main>
  );
}
