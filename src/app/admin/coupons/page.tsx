import { saveCoupon } from "@/server/actions/admin";
import { supabaseAdmin, throwIf } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const db = supabaseAdmin();
  const { data: coupons, error } = await db.from("Coupon").select("*").order("createdAt", { ascending: false });
  throwIf(error);
  const usage = await Promise.all(
    (coupons || []).map(async (coupon) => {
      const { count, error: countError } = await db.from("CouponRedemption").select("id", { count: "exact", head: true }).eq("couponId", coupon.id);
      throwIf(countError);
      return { id: coupon.id, redemptions: count ?? 0 };
    }),
  );
  const usageById = Object.fromEntries(usage.map((row) => [row.id, row.redemptions]));
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">Coupons</h1>
      <ul className="mt-6 text-sm">
        {(coupons || []).map((coupon) => (
          <li key={coupon.id} className="border-b border-line py-2">
            {coupon.code} · {coupon.type.toLowerCase().replaceAll("_", " ")} · {coupon.amount} · {usageById[coupon.id] ?? 0} used · {coupon.active ? "active" : "off"}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-stone">Percent amounts are entered as a percent (10 means 10%). Fixed amounts are cedis. Free shipping ignores the amount.</p>
      <div className="mt-6">
        <AdminForm action={saveCoupon} submit="Save coupon">
          <Label>Code<Input name="code" required /></Label>
          <Label>Type
            <select name="type" className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm">
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed amount</option>
              <option value="FREE_SHIPPING">Free shipping</option>
            </select>
          </Label>
          <Label>Amount<Input name="amount" defaultValue="0" /></Label>
          <Label>Minimum subtotal (GHS)<Input name="minSubtotal" /></Label>
          <Label>Maximum discount (GHS)<Input name="maxDiscount" /></Label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Active</label>
        </AdminForm>
      </div>
    </main>
  );
}
