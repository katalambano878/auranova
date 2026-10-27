"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { clearCart, setCoupon, updateCartItem } from "@/server/actions/storefront";
import { Button } from "@/components/ui/button";

export function CartEditor({
  currency,
  items,
}: {
  currency: string;
  items: { id: string; name: string; variant: string | null; image?: string; quantity: number; unitPrice: number; lineTotal: number; problem: string | null }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + (item.problem ? 0 : item.lineTotal), 0);
  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[5.5rem_1fr] gap-4 rounded-[1.5rem] bg-mist p-4">
          {item.image ? (
            <div className="h-24 w-20 overflow-hidden rounded-2xl bg-white">
              <img src={item.image} alt="" className={item.image.startsWith("/demo/") ? "h-full w-full scale-[2.2] object-cover object-[center_40%]" : "h-full w-full object-cover"} />
            </div>
          ) : <div className="h-24 w-20 rounded-2xl bg-white" />}
          <div>
            <p className="font-serif text-xl">{item.name}</p>
            {item.variant ? <p className="text-sm text-stone">{item.variant}</p> : null}
            <p className="mt-1">{formatMoney(item.unitPrice, currency)}</p>
            {item.problem ? <p className="text-sm text-danger">{item.problem}</p> : null}
            <div className="mt-2 flex items-center gap-3">
              <label className="sr-only" htmlFor={`qty-${item.id}`}>Quantity</label>
              <input id={`qty-${item.id}`} type="number" min={0} defaultValue={item.quantity} className="w-16 rounded-full border border-line bg-white px-2 py-1" onBlur={async (event) => {
                const result = await updateCartItem(item.id, Number(event.target.value));
                if (!result.ok) toast.error(result.error);
                router.refresh();
              }} />
              <button type="button" className="text-sm underline" onClick={async () => { await updateCartItem(item.id, 0); router.refresh(); }}>Remove</button>
              <p className="ml-auto">{formatMoney(item.lineTotal, currency)}</p>
            </div>
          </div>
        </div>
      ))}
      <form className="flex gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") || "");
        const result = await setCoupon(code);
        if (!result.ok) toast.error(result.error);
        else toast.success(code ? "Coupon saved for checkout" : "Coupon removed");
      }}>
        <label className="sr-only" htmlFor="coupon">Coupon</label>
        <input id="coupon" name="code" placeholder="Coupon" className="rounded-full border border-line bg-white px-4 py-2" />
        <Button type="submit" variant="line">Apply</Button>
      </form>
      <p className="text-lg">Subtotal {formatMoney(subtotal, currency)}</p>
      <p className="text-sm text-stone">Delivery is calculated from your address at checkout. The server recalculates every price before an order is created.</p>
      <div className="flex gap-3">
        <Button onClick={() => router.push("/checkout")}>Checkout</Button>
        <Button variant="ghost" disabled={pending} onClick={async () => { setPending(true); await clearCart(); setPending(false); router.refresh(); }}>Clear bag</Button>
      </div>
    </div>
  );
}
