import { formatMoney } from "@/lib/money";
import { saveShipping } from "@/server/actions/admin";
import { supabaseAdmin, throwIf } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const { data: zonesRaw, error } = await supabaseAdmin()
    .from("ShippingZone")
    .select("*, methods:ShippingMethod(*)")
    .order("name");
  throwIf(error);
  const zones = (zonesRaw || []).map((zone) => ({
    ...zone,
    methods: [...(zone.methods || [])].sort((a, b) => a.position - b.position),
  }));
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">Shipping</h1>
      {zones.map((zone) => (
        <section key={zone.id} className="mt-8">
          <h2 className="font-serif text-2xl">{zone.name}</h2>
          <p className="text-sm text-stone">{zone.regions.join(", ")}</p>
          <ul className="mt-3 space-y-4">
            {zone.methods.map((method: any) => (
              <li key={method.id} className="border border-line p-4">
                <p className="text-sm text-stone">Current fee {formatMoney(method.fee)}{method.freeThreshold ? ` · free over ${formatMoney(method.freeThreshold)}` : ""}</p>
                <AdminForm action={saveShipping}>
                  <input type="hidden" name="id" value={method.id} />
                  <Label>Name<Input name="name" defaultValue={method.name} /></Label>
                  <Label>Fee (GHS)<Input name="fee" defaultValue={(method.fee / 100).toFixed(2)} /></Label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={method.active} /> Active</label>
                </AdminForm>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
