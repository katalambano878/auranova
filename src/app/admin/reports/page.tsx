import { formatMoney } from "@/lib/money";
import { salesReport } from "@/server/reports";
import { startOfMonthInTimeZone } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams;
  const month = startOfMonthInTimeZone(new Date(), "Africa/Accra");
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : month;
  const to = query.to ? new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000) : new Date();
  const report = await salesReport(from, to);
  return (
    <main>
      <h1 className="font-serif text-4xl">Reports</h1>
      <p className="mt-2 text-sm text-stone">Revenue counts paid and partially refunded orders, then subtracts completed refunds. Unpaid, cancelled, and fully refunded orders are left out.</p>
      <form className="mt-6 flex flex-wrap items-end gap-3 text-sm">
        <label>From<input type="date" name="from" defaultValue={query.from || ""} className="mt-1 block border border-line bg-card px-3 py-2" /></label>
        <label>To<input type="date" name="to" defaultValue={query.to || ""} className="mt-1 block border border-line bg-card px-3 py-2" /></label>
        <button className="rounded-full bg-forest px-4 py-2 text-white" type="submit">Update</button>
        <a className="underline" href={`/api/admin/reports.csv?from=${from.toISOString()}&to=${to.toISOString()}`}>Download CSV</a>
      </form>
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="border border-line p-4"><p className="text-xs uppercase tracking-[0.14em] text-stone">Revenue</p><p className="mt-2 font-serif text-3xl">{formatMoney(report.revenue)}</p></article>
        <article className="border border-line p-4"><p className="text-xs uppercase tracking-[0.14em] text-stone">Orders</p><p className="mt-2 font-serif text-3xl">{report.orders}</p></article>
        <article className="border border-line p-4"><p className="text-xs uppercase tracking-[0.14em] text-stone">Average</p><p className="mt-2 font-serif text-3xl">{formatMoney(report.average)}</p></article>
      </section>
      <p className="mt-4 text-sm text-stone">{report.demoOrders} demonstration order{report.demoOrders === 1 ? "" : "s"} in this range.</p>
      <table className="mt-6 w-full text-left text-sm">
        <thead><tr className="border-b border-line"><th className="py-2">Day (Accra)</th><th>Revenue</th></tr></thead>
        <tbody>
          {report.byDay.map(([day, amount]) => <tr key={day} className="border-b border-line"><td className="py-2">{day}</td><td>{formatMoney(amount)}</td></tr>)}
        </tbody>
      </table>
    </main>
  );
}
