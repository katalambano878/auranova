import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { canTransitionFulfilment, fulfilmentStatuses } from "@/lib/order-status";
import { addOrderNote, manualRefundAction, refundAction, updateFulfilment } from "@/server/actions/admin";
import { prisma } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Input, Label, Textarea } from "@/components/ui/fields";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, attempts: true, refunds: true, events: { orderBy: { createdAt: "asc" } }, notes: { include: { author: true } }, shipment: true },
  });
  if (!order) notFound();
  const nextStatuses = fulfilmentStatuses.filter((status) => canTransitionFulfilment(order.fulfilmentStatus, status));
  const address = order.shippingAddress as Record<string, string | null>;
  return (
    <main className="max-w-4xl">
      <p className="text-sm"><Link href="/admin/orders" className="underline">Orders</Link></p>
      <h1 className="mt-2 font-serif text-4xl">{order.number}</h1>
      {order.isDemo ? <p className="mt-2 text-sm text-copper">Demonstration order. It is included in revenue because it is marked paid.</p> : null}
      <p className="mt-2 text-sm text-stone">{order.customerName} · {order.email} · {order.phone}</p>
      <p className="text-sm">Payment {order.paymentStatus.toLowerCase()} · {order.fulfilmentStatus.toLowerCase().replaceAll("_", " ")} · {order.provider || "no provider"}</p>
      <p className="mt-4 text-sm">{[address.line1, address.city, address.region, address.landmark, address.digitalAddress].filter(Boolean).join(", ")}</p>
      <div className="mt-4 flex gap-4 text-sm">
        <Link className="underline" href={`/admin/orders/${order.id}/invoice`}>Invoice</Link>
        <Link className="underline" href={`/admin/orders/${order.id}/packing`}>Packing slip</Link>
      </div>
      <table className="mt-6 w-full text-left text-sm">
        <thead><tr className="border-b border-line"><th className="py-2">Item</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-2">{item.name}{item.variantName ? ` · ${item.variantName}` : ""}</td>
              <td>{item.sku}</td>
              <td>{item.quantity}</td>
              <td>{formatMoney(item.unitPrice, order.currency)}</td>
              <td>{formatMoney(item.lineTotal, order.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-4 max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal, order.currency)}</dd></div>
        <div className="flex justify-between"><dt>Discount</dt><dd>{formatMoney(order.discount, order.currency)}</dd></div>
        <div className="flex justify-between"><dt>{order.shippingMethodName}</dt><dd>{formatMoney(order.shippingFee, order.currency)}</dd></div>
        <div className="flex justify-between"><dt>Tax {order.taxInclusive ? "(included)" : ""}</dt><dd>{formatMoney(order.tax, order.currency)}</dd></div>
        <div className="flex justify-between font-medium"><dt>Total</dt><dd>{formatMoney(order.total, order.currency)}</dd></div>
      </dl>
      {order.shipment?.trackingRef ? <p className="mt-4 text-sm">Tracking {order.shipment.trackingRef}</p> : null}
      <section className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl">Fulfilment</h2>
          {nextStatuses.length ? (
            <AdminForm action={updateFulfilment} submit="Update status">
              <input type="hidden" name="orderId" value={order.id} />
              <Label>Next status
                <select name="to" className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm">
                  {nextStatuses.map((status) => <option key={status} value={status}>{status.toLowerCase().replaceAll("_", " ")}</option>)}
                </select>
              </Label>
              <Label>Tracking reference<Input name="trackingRef" /></Label>
              <Label>Note<Input name="note" /></Label>
            </AdminForm>
          ) : <p className="mt-3 text-sm text-stone">No further fulfilment transitions are allowed.</p>}
        </div>
        <div>
          <h2 className="font-serif text-2xl">Internal note</h2>
          <AdminForm action={addOrderNote} submit="Add note">
            <input type="hidden" name="orderId" value={order.id} />
            <Textarea name="body" required rows={3} />
          </AdminForm>
          <ul className="mt-3 text-sm">{order.notes.map((note) => <li key={note.id} className="border-b border-line py-2">{note.body}<span className="block text-stone">{note.author?.name || "Staff"}</span></li>)}</ul>
        </div>
      </section>
      <section className="mt-10">
        <h2 className="font-serif text-2xl">Refund</h2>
        <p className="mt-2 text-sm text-stone">A refund does not restock unless you tick restock. Moolre and Hubtel stay pending until a super admin confirms the provider dashboard refund.</p>
        <AdminForm action={refundAction} submit="Request refund">
          <input type="hidden" name="orderId" value={order.id} />
          <Label>Amount (GHS)<Input name="amount" required /></Label>
          <Label>Reason<Input name="reason" required /></Label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="restock" /> Restock this refund</label>
        </AdminForm>
        {order.refunds.filter((refund) => refund.status === "PENDING").map((refund) => (
          <div key={refund.id} className="mt-4 border border-line p-3">
            <p className="text-sm">Pending {formatMoney(refund.amount, order.currency)} · {refund.reason}</p>
            <AdminForm action={manualRefundAction} submit="Confirm manual refund">
              <input type="hidden" name="refundId" value={refund.id} />
              <Label>Why this is being confirmed by hand<Input name="reason" required /></Label>
            </AdminForm>
          </div>
        ))}
      </section>
      <section className="mt-10">
        <h2 className="font-serif text-2xl">Payments</h2>
        <ul className="mt-3 text-sm">
          {order.attempts.map((attempt) => <li key={attempt.id} className="border-b border-line py-2">{attempt.provider} · {attempt.reference} · {attempt.status.toLowerCase()} · {formatMoney(attempt.amount, attempt.currency)}</li>)}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-serif text-2xl">History</h2>
        <ul className="mt-3 text-sm">{order.events.map((event) => <li key={event.id} className="border-b border-line py-2">{event.kind} {event.fromStatus || ""} → {event.toStatus || ""} {event.note || ""}</li>)}</ul>
      </section>
    </main>
  );
}
