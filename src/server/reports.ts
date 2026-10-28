import { accraDayKey, startOfDayInTimeZone, startOfMonthInTimeZone } from "@/lib/time";
import { supabaseAdmin, throwIf } from "./db";

const paidStatuses = ["PAID", "PARTIALLY_REFUNDED"] as const;

type OrderRow = {
  total: number;
  paidAt: string | null;
  isDemo: boolean;
  refunds: { status: string; amount: number }[];
};

function net(order: OrderRow) {
  const refunded = (order.refunds || []).filter((refund) => refund.status === "REFUNDED").reduce((sum, refund) => sum + refund.amount, 0);
  return Math.max(order.total - refunded, 0);
}

export async function salesReport(from: Date, to: Date) {
  const { data: orders, error } = await supabaseAdmin()
    .from("Order")
    .select("total, paidAt, isDemo, refunds:Refund(amount, status)")
    .gte("paidAt", from.toISOString())
    .lt("paidAt", to.toISOString())
    .in("paymentStatus", [...paidStatuses]);
  throwIf(error);
  const rows = (orders || []) as OrderRow[];
  const revenue = rows.reduce((sum, order) => sum + net(order), 0);
  const byDay = new Map<string, number>();
  for (const order of rows) {
    if (!order.paidAt) continue;
    const key = accraDayKey(new Date(order.paidAt));
    byDay.set(key, (byDay.get(key) || 0) + net(order));
  }
  return {
    revenue,
    orders: rows.length,
    average: rows.length ? Math.round(revenue / rows.length) : 0,
    demoOrders: rows.filter((order) => order.isDemo).length,
    byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}

export async function dashboardMetrics() {
  const now = new Date();
  const today = startOfDayInTimeZone(now, "Africa/Accra");
  const month = startOfMonthInTimeZone(now, "Africa/Accra");
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const db = supabaseAdmin();
  const [todaySales, monthSales, fulfilmentRows, customersCount, lowStockResult, recentResult] = await Promise.all([
    salesReport(today, tomorrow),
    salesReport(month, tomorrow),
    db.from("Order").select("fulfilmentStatus"),
    db.from("User").select("id", { count: "exact", head: true }).eq("role", "customer"),
    db
      .from("Product")
      .select("id, name, sku, onHand, reserved, lowStockThreshold, variants:ProductVariant(onHand, reserved)")
      .eq("status", "PUBLISHED")
      .is("deletedAt", null)
      .eq("trackInventory", true)
      .limit(200),
    db.from("Order").select("*").order("createdAt", { ascending: false }).limit(8),
  ]);
  throwIf(fulfilmentRows.error);
  throwIf(customersCount.error);
  throwIf(lowStockResult.error);
  throwIf(recentResult.error);
  const countsMap = new Map<string, number>();
  for (const row of fulfilmentRows.data || []) {
    countsMap.set(row.fulfilmentStatus, (countsMap.get(row.fulfilmentStatus) || 0) + 1);
  }
  const counts = [...countsMap.entries()].map(([fulfilmentStatus, _count]) => ({ fulfilmentStatus, _count }));
  const low = (lowStockResult.data || []).filter((product) => {
    const variants = product.variants || [];
    const units = variants.length
      ? variants.reduce((sum, variant) => sum + variant.onHand - variant.reserved, 0)
      : product.onHand - product.reserved;
    return units <= product.lowStockThreshold;
  });
  return { todaySales, monthSales, counts, customers: customersCount.count ?? 0, low, recent: recentResult.data || [] };
}
