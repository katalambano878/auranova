import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { csvCell } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/session";

export async function GET(request: Request) {
  const access = await requirePermission("reports.read");
  if (!access.ok) return NextResponse.json({ ok: false }, { status: access.status });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      paidAt: {
        gte: from ? new Date(from) : undefined,
        lt: to ? new Date(to) : undefined,
      },
    },
    include: { refunds: true },
    orderBy: { paidAt: "asc" },
  });
  const header = "number,paidAt,paymentStatus,fulfilmentStatus,total,refunded,net,currency,demo";
  const lines = orders.map((order) => {
    const refunded = order.refunds.filter((refund) => refund.status === "REFUNDED").reduce((sum, refund) => sum + refund.amount, 0);
    return [
      order.number,
      order.paidAt?.toISOString() || "",
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
