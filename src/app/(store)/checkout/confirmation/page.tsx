import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { verifyAttempt } from "@/server/payments/settle";
import { supabaseAdmin, throwIf } from "@/server/db";
import { getSettings } from "@/server/settings";
import { RetryPayment } from "@/components/store/retry-payment";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ attempt?: string }> }) {
  const { attempt } = await searchParams;
  if (!attempt) notFound();
  const result = await verifyAttempt(attempt);
  const { data: record, error } = await supabaseAdmin()
    .from("PaymentAttempt")
    .select("*, order:Order(*, items:OrderItem(*))")
    .eq("reference", attempt)
    .maybeSingle();
  throwIf(error);
  if (!record?.order) notFound();
  const settings = await getSettings();
  const paid = result.ok && result.status === "successful";
  const failed = result.ok && result.status === "failed";
  const address = record.order.shippingAddress as { line1?: string; city?: string; region?: string };
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro
        eyebrow={record.order.number}
        title={paid ? "Payment confirmed" : record.provider === "pay_on_delivery" ? "Order placed" : failed ? "Payment not completed" : "Payment pending"}
      />
      <div className="mt-10 max-w-2xl rounded-[2rem] bg-mist p-8">
      <p className="text-stone">
        {paid
          ? "The provider confirmed this payment. The amount and currency matched the order."
          : record.provider === "pay_on_delivery"
            ? "Pay on delivery is unpaid until the courier collects it. This is not an online payment success."
            : "Returning from a payment page does not mark an order paid. This page checks the provider."}
      </p>
      {!result.ok ? <p className="mt-3 text-danger">{result.error}</p> : null}
      <dl className="mt-8 space-y-2 text-sm">
        <div className="flex justify-between"><dt>Total</dt><dd>{formatMoney(record.order.total, record.order.currency)}</dd></div>
        <div className="flex justify-between"><dt>Payment</dt><dd>{record.order.paymentStatus.toLowerCase().replaceAll("_", " ")}</dd></div>
        <div className="flex justify-between"><dt>Fulfilment</dt><dd>{record.order.fulfilmentStatus.toLowerCase().replaceAll("_", " ")}</dd></div>
        <div className="flex justify-between"><dt>Deliver to</dt><dd>{address.line1}, {address.city}, {address.region}</dd></div>
      </dl>
      <ul className="mt-6 space-y-2 text-sm">
        {record.order.items.map((item: any) => <li key={item.id}>{item.quantity} × {item.name}{item.variantName ? ` (${item.variantName})` : ""}</li>)}
      </ul>
      {!paid && record.provider !== "pay_on_delivery" ? <RetryPayment reference={attempt} /> : null}
      <p className="mt-8 text-sm">Questions: {settings.supportEmail || settings.supportPhone || "see the contact page"}.</p>
      <p className="mt-4"><Link href={`/track-order?order=${record.order.number}`} className="underline">Track this order</Link></p>
      </div>
    </main>
  );
}
