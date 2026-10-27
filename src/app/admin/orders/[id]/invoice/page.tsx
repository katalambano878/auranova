import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { items: true } }),
    getSettings(),
  ]);
  if (!order) notFound();
  const address = order.shippingAddress as Record<string, string | null>;
  return (
    <main className="mx-auto max-w-3xl bg-card p-8">
      <p className="text-xs uppercase tracking-[0.16em]">Invoice</p>
      <h1 className="font-serif text-4xl">{order.number}</h1>
      <p className="mt-2 text-sm">{settings.legalName || settings.storeName}{settings.tin ? ` · TIN ${settings.tin}` : ""}</p>
      <p className="text-sm text-stone">{order.customerName} · {order.email}</p>
      <p className="text-sm text-stone">{[address.line1, address.city, address.region].filter(Boolean).join(", ")}</p>
      <table className="mt-6 w-full text-left text-sm">
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-2">{item.quantity} × {item.name}{item.variantName ? ` (${item.variantName})` : ""}</td>
              <td>{item.sku}</td>
              <td className="text-right">{formatMoney(item.lineTotal, order.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-right">Total {formatMoney(order.total, order.currency)}</p>
      <p className="mt-2 text-right text-sm text-stone">Payment {order.paymentStatus.toLowerCase()}. {order.taxInclusive ? "Prices include tax." : ""} Tax shown: {formatMoney(order.tax, order.currency)}.</p>
      <p className="no-print mt-6 text-sm text-stone">Use the browser print dialog. This page does not invent a tracking number or a delivery date.</p>
    </main>
  );
}
