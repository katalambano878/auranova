import { prisma } from "./db";
import { startOfDayInTimeZone, startOfMonthInTimeZone, accraDayKey } from "@/lib/time";

const paidStatuses = ["PAID", "PARTIALLY_REFUNDED"] as const;

export async function salesReport(from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: { paidAt: { gte: from, lt: to }, paymentStatus: { in: [...paidStatuses] } },
    include: { refunds: true, items: true },
  });
  const net = (order: (typeof orders)[number]) => {
    const refunded = order.refunds.filter((refund) => refund.status === "REFUNDED").reduce((sum, refund) => sum + refund.amount, 0);
    return Math.max(order.total - refunded, 0);
  };
  const revenue = orders.reduce((sum, order) => sum + net(order), 0);
  const byDay = new Map<string, number>();
  for (const order of orders) {
    if (!order.paidAt) continue;
    const key = accraDayKey(order.paidAt);
    byDay.set(key, (byDay.get(key) || 0) + net(order));
  }
  return {
    revenue,
    orders: orders.length,
    average: orders.length ? Math.round(revenue / orders.length) : 0,
    demoOrders: orders.filter((order) => order.isDemo).length,
    byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}

export async function dashboardMetrics() {
  const now = new Date();
  const today = startOfDayInTimeZone(now, "Africa/Accra");
  const month = startOfMonthInTimeZone(now, "Africa/Accra");
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const [todaySales, monthSales, counts, customers, lowStock, recent] = await Promise.all([
    salesReport(today, tomorrow),
    salesReport(month, tomorrow),
    prisma.order.groupBy({ by: ["fulfilmentStatus"], _count: true }),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.product.findMany({ where: { status: "PUBLISHED", deletedAt: null, trackInventory: true }, include: { variants: true }, take: 200 }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const low = lowStock.filter((product) => {
    const units = product.variants.length
      ? product.variants.reduce((sum, variant) => sum + variant.onHand - variant.reserved, 0)
      : product.onHand - product.reserved;
    return units <= product.lowStockThreshold;
  });
  return { todaySales, monthSales, counts, customers, low, recent };
}
