import { notFound, redirect } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { supabaseAdmin, throwIf } from "@/server/db";
import { getSession } from "@/server/session";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getSession();
  if (!session) redirect("/account/login");
  const { orderNumber } = await params;
  const { data: order, error } = await supabaseAdmin()
    .from("Order")
    .select("*, items:OrderItem(*), shipment:Shipment(*)")
    .eq("number", orderNumber)
    .eq("userId", session.user.id)
    .maybeSingle();
  throwIf(error);
  if (!order) notFound();
  const shipment = Array.isArray(order.shipment) ? order.shipment[0] : order.shipment;
  const address = order.shippingAddress as { line1?: string; city?: string; region?: string };
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Order" title={order.number} body={`Payment ${order.paymentStatus.toLowerCase()} · ${order.fulfilmentStatus.toLowerCase().replaceAll("_", " ")}`} />
      {shipment?.trackingRef ? <p className="mt-2">Tracking {shipment.trackingRef}</p> : <p className="mt-2 text-sm text-stone">No tracking reference has been added.</p>}
      <p className="mt-4 text-sm">{address.line1}, {address.city}, {address.region}</p>
      <ul className="mt-6 space-y-2">
        {order.items.map((item: any) => <li key={item.id} className="flex justify-between text-sm"><span>{item.quantity} × {item.name}{item.variantName ? ` (${item.variantName})` : ""}</span><span>{formatMoney(item.lineTotal, order.currency)}</span></li>)}
      </ul>
      <p className="mt-4 text-lg">Total {formatMoney(order.total, order.currency)}</p>
    </main>
  );
}
