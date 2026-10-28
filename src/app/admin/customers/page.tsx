import Link from "next/link";
import { supabaseAdmin, throwIf } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const db = supabaseAdmin();
  const [customersRes, requestsRes] = await Promise.all([
    db.from("User").select("*").eq("role", "customer").order("createdAt", { ascending: false }).limit(100),
    db.from("DataRequest").select("*, user:User(*)").eq("status", "PENDING"),
  ]);
  throwIf(customersRes.error);
  throwIf(requestsRes.error);
  const customers = await Promise.all(
    (customersRes.data || []).map(async (customer) => {
      const { count, error } = await db.from("Order").select("id", { count: "exact", head: true }).eq("userId", customer.id);
      throwIf(error);
      return { ...customer, _count: { orders: count ?? 0 } };
    }),
  );
  const requests = requestsRes.data || [];
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
