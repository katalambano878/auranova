import { saveCategory } from "@/server/actions/admin";
import { supabaseAdmin, throwIf } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label, Textarea } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const db = supabaseAdmin();
  const { data: categories, error } = await db.from("Category").select("*").is("deletedAt", null).order("position");
  throwIf(error);
  const counts = await Promise.all(
    (categories || []).map(async (category) => {
      const { count, error: countError } = await db.from("Product").select("id", { count: "exact", head: true }).eq("categoryId", category.id);
      throwIf(countError);
      return { id: category.id, count: count ?? 0 };
    }),
  );
  const countById = Object.fromEntries(counts.map((row) => [row.id, row.count]));
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">Categories</h1>
      <ul className="mt-6 text-sm">{(categories || []).map((category) => <li key={category.id} className="border-b border-line py-2">{category.name} · {category.slug} · {countById[category.id] ?? 0}</li>)}</ul>
      <div className="mt-8">
        <AdminForm action={saveCategory} submit="Save category">
          <Label>Name<Input name="name" required /></Label>
          <Label>Slug<Input name="slug" /></Label>
          <Label>Description<Textarea name="description" rows={3} /></Label>
        </AdminForm>
      </div>
    </main>
  );
}
