import { saveCategory } from "@/server/actions/admin";
import { prisma } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label, Textarea } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">Categories</h1>
      <ul className="mt-6 text-sm">{categories.map((category) => <li key={category.id} className="border-b border-line py-2">{category.name} · {category.slug} · {category._count.products}</li>)}</ul>
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
