import { notFound } from "next/navigation";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, shipment: true } });
  if (!order) notFound();
  const address = order.shippingAddress as Record<string, string | null>;
  return (
    <main className="mx-auto max-w-3xl bg-card p-8">
      <p className="text-xs uppercase tracking-[0.16em]">Packing slip</p>
      <h1 className="font-serif text-4xl">{order.number}</h1>
      <p className="mt-3">{order.customerName}</p>
      <p>{[address.line1, address.city, address.region, address.landmark].filter(Boolean).join(", ")}</p>
      <p className="mt-2 text-sm">Method: {order.shippingMethodName}</p>
      {order.shipment?.trackingRef ? <p className="text-sm">Tracking: {order.shipment.trackingRef}</p> : <p className="text-sm text-stone">No tracking reference has been entered.</p>}
      <ul className="mt-6">
        {order.items.map((item) => <li key={item.id} className="border-b border-line py-2">{item.quantity} × {item.name}{item.variantName ? ` · ${item.variantName}` : ""} · {item.sku}</li>)}
      </ul>
      <p className="no-print mt-6 text-sm text-stone">Print this slip from the browser. Delivery dates are not estimated here.</p>
    </main>
  );
}
