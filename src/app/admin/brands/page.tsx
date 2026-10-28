import { saveBrand } from "@/server/actions/admin";
import { supabaseAdmin, throwIf } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const { data: brands, error } = await supabaseAdmin().from("Brand").select("*").is("deletedAt", null).order("name");
  throwIf(error);
  return (
    <main className="max-w-xl">
      <h1 className="font-serif text-4xl">Brands</h1>
      <ul className="mt-6 text-sm">{(brands || []).map((brand) => <li key={brand.id} className="border-b border-line py-2">{brand.name}</li>)}</ul>
      <div className="mt-8">
        <AdminForm action={saveBrand}>
          <Label>Name<Input name="name" required /></Label>
          <Label>Slug<Input name="slug" /></Label>
        </AdminForm>
      </div>
    </main>
  );
}
