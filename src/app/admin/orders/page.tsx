import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const orders = await prisma.order.findMany({
    where: status ? { fulfilmentStatus: status as "PENDING" } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <main>
      <h1 className="font-serif text-4xl">Orders</h1>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/orders" className="underline">All</Link>
        {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((item) => (
          <Link key={item} href={`/admin/orders?status=${item}`} className="underline">{item.toLowerCase().replaceAll("_", " ")}</Link>
        ))}
      </div>
      <table className="mt-6 w-full text-left text-sm">
        <thead><tr className="border-b border-line text-stone"><th className="py-2">Order</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th>Total</th></tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-line">
              <td className="py-2"><Link className="underline" href={`/admin/orders/${order.id}`}>{order.number}</Link>{order.isDemo ? " · demo" : ""}</td>
              <td>{order.customerName}</td>
              <td>{order.paymentStatus.toLowerCase()}</td>
              <td>{order.fulfilmentStatus.toLowerCase().replaceAll("_", " ")}</td>
              <td>{formatMoney(order.total, order.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
