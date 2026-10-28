import { supabaseAdmin, throwIf } from "@/server/db";
import { ProductEditor } from "@/components/admin/product-editor";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [categoriesRes, brandsRes] = await Promise.all([
    supabaseAdmin().from("Category").select("*").is("deletedAt", null).order("name"),
    supabaseAdmin().from("Brand").select("*").is("deletedAt", null).order("name"),
  ]);
  throwIf(categoriesRes.error);
  throwIf(brandsRes.error);
  const categories = categoriesRes.data || [];
  const brands = brandsRes.data || [];
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">New product</h1>
      <div className="mt-6"><ProductEditor categories={categories} brands={brands} /></div>
    </main>
  );
}
