import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { can } from "@/server/permissions";
import { dashboardMetrics } from "@/server/reports";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await getSession();
  const metrics = await dashboardMetrics();
  const showMoney = session ? can(session.user.role, "reports.read") : false;
  return (
    <main>
      <h1 className="font-serif text-4xl">Overview</h1>
      <p className="mt-2 text-sm text-stone">Today and this month use Africa/Accra. Unpaid, cancelled, and fully refunded orders are excluded from revenue. The seeded demonstration order is included and labelled.</p>
      {showMoney ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Today" value={formatMoney(metrics.todaySales.revenue)} detail={`${metrics.todaySales.orders} paid`} />
          <Stat label="This month" value={formatMoney(metrics.monthSales.revenue)} detail={`${metrics.monthSales.orders} paid · ${metrics.monthSales.demoOrders} demonstration`} />
          <Stat label="Average order" value={formatMoney(metrics.monthSales.average)} detail="This month, after refunds" />
          <Stat label="Customers" value={String(metrics.customers)} detail="Role: customer" />
        </section>
      ) : <p className="mt-6 text-sm text-stone">Revenue figures are limited to roles with report access.</p>}
      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl">Fulfilment</h2>
          <ul className="mt-3 text-sm">
            {metrics.counts.map((row) => <li key={row.fulfilmentStatus} className="flex justify-between border-b border-line py-2"><span>{row.fulfilmentStatus.toLowerCase().replaceAll("_", " ")}</span><span>{row._count}</span></li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-2xl">Low stock</h2>
          {metrics.low.length === 0 ? <p className="mt-3 text-sm text-stone">Nothing is at or below its threshold.</p> : (
            <ul className="mt-3 text-sm">
              {metrics.low.slice(0, 8).map((product) => <li key={product.id} className="border-b border-line py-2"><Link href={`/admin/products/${product.id}`} className="underline">{product.name}</Link></li>)}
            </ul>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="font-serif text-2xl">Recent orders</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead><tr className="border-b border-line text-stone"><th className="py-2 font-medium">Order</th><th>Payment</th><th>Fulfilment</th><th>Total</th></tr></thead>
          <tbody>
            {metrics.recent.map((order) => (
              <tr key={order.id} className="border-b border-line">
                <td className="py-2"><Link href={`/admin/orders/${order.id}`} className="underline">{order.number}</Link>{order.isDemo ? " · demo" : ""}</td>
                <td>{order.paymentStatus.toLowerCase()}</td>
                <td>{order.fulfilmentStatus.toLowerCase().replaceAll("_", " ")}</td>
                <td>{formatMoney(order.total, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="border border-line bg-card p-4"><p className="text-xs uppercase tracking-[0.14em] text-stone">{label}</p><p className="mt-2 font-serif text-3xl">{value}</p><p className="mt-1 text-sm text-stone">{detail}</p></article>;
}
