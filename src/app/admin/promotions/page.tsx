import { savePromotion } from "@/server/actions/admin";
import { prisma } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const promotions = await prisma.promotion.findMany({ orderBy: { position: "asc" } });
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">Promotions</h1>
      <ul className="mt-6 space-y-4">
        {promotions.map((promotion) => (
          <li key={promotion.id} className="border border-line p-4">
            <AdminForm action={savePromotion}>
              <input type="hidden" name="id" value={promotion.id} />
              <Label>Title<Input name="title" defaultValue={promotion.title} required /></Label>
              <Label>Subtitle<Input name="subtitle" defaultValue={promotion.subtitle} /></Label>
              <Label>Button label<Input name="ctaLabel" defaultValue={promotion.ctaLabel || ""} /></Label>
              <Label>Button link<Input name="ctaHref" defaultValue={promotion.ctaHref || ""} /></Label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={promotion.active} /> Active</label>
            </AdminForm>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <h2 className="font-serif text-2xl">New promotion</h2>
        <AdminForm action={savePromotion} submit="Create">
          <Label>Title<Input name="title" required /></Label>
          <Label>Subtitle<Input name="subtitle" /></Label>
          <Label>Button label<Input name="ctaLabel" /></Label>
          <Label>Button link<Input name="ctaHref" /></Label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Active</label>
        </AdminForm>
      </div>
    </main>
  );
}
