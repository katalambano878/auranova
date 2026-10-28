import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { supabaseAdmin, throwIf } from "@/server/db";
import { requirePermission } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requirePermission("reports.read");
  if (!access.ok) return NextResponse.json({ ok: false }, { status: access.status });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  let query = supabaseAdmin()
    .from("Order")
    .select("number, paidAt, paymentStatus, fulfilmentStatus, total, currency, isDemo, refunds:Refund(amount, status)")
    .in("paymentStatus", ["PAID", "PARTIALLY_REFUNDED"])
    .order("paidAt");
  if (from) query = query.gte("paidAt", new Date(from).toISOString());
  if (to) query = query.lt("paidAt", new Date(to).toISOString());
  const { data: orders, error } = await query;
  throwIf(error);
  const header = "number,paidAt,paymentStatus,fulfilmentStatus,total,refunded,net,currency,demo";
  const lines = (orders || []).map((order) => {
    const refunded = (order.refunds || []).filter((refund) => refund.status === "REFUNDED").reduce((sum, refund) => sum + refund.amount, 0);
    return [
      order.number,
      order.paidAt ? new Date(order.paidAt).toISOString() : "",
      order.paymentStatus,
      order.fulfilmentStatus,
      formatMoney(order.total, order.currency),
      formatMoney(refunded, order.currency),
      formatMoney(Math.max(order.total - refunded, 0), order.currency),
      order.currency,
      order.isDemo ? "yes" : "no",
    ].map(csvCell).join(",");
  });
  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=auranova-sales.csv",
    },
  });
}
