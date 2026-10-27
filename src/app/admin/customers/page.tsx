import Link from "next/link";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.user.findMany({
    where: { role: "customer" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { orders: true } } },
  });
  const requests = await prisma.dataRequest.findMany({ where: { status: "PENDING" }, include: { user: true } });
  return (
    <main>
      <h1 className="font-serif text-4xl">Customers</h1>
      {requests.length ? <p className="mt-3 text-sm">{requests.length} data request{requests.length === 1 ? "" : "s"} waiting. Open the customer to review.</p> : null}
      <table className="mt-6 w-full text-left text-sm">
        <thead><tr className="border-b border-line text-stone"><th className="py-2">Name</th><th>Email</th><th>Orders</th><th>Status</th></tr></thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b border-line">
              <td className="py-2"><Link className="underline" href={`/admin/customers/${customer.id}`}>{customer.name}</Link></td>
              <td>{customer.email}</td>
              <td>{customer._count.orders}</td>
              <td>{customer.banned ? "Suspended" : "Active"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
