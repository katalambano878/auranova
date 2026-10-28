import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { setCustomerBan } from "@/server/actions/admin";
import { resolveDataRequest } from "@/server/actions/admin-ops";
import { supabaseAdmin, throwIf } from "@/server/db";
import { AdminForm } from "@/components/admin/form";
import { Label } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: customer, error } = await supabaseAdmin()
    .from("User")
    .select("*, orders:Order(*), addresses:Address(*), dataRequests:DataRequest(*)")
    .eq("id", id)
    .maybeSingle();
  throwIf(error);
  if (!customer || customer.role !== "customer") notFound();
  customer.orders = [...(customer.orders || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
  customer.dataRequests = [...(customer.dataRequests || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">{customer.name}</h1>
      <p className="mt-2 text-sm text-stone">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
      <form className="mt-4" action={async () => {
        "use server";
        await setCustomerBan(customer.id, !customer.banned);
      }}>
        <Button type="submit" variant="line">{customer.banned ? "Restore account" : "Suspend account"}</Button>
      </form>
      <h2 className="mt-8 font-serif text-2xl">Orders</h2>
      <ul className="mt-3 text-sm">{customer.orders.map((order: any) => <li key={order.id} className="border-b border-line py-2">{order.number} · {order.paymentStatus.toLowerCase()} · {formatMoney(order.total, order.currency)}</li>)}</ul>
      <h2 className="mt-8 font-serif text-2xl">Addresses</h2>
      <ul className="mt-3 text-sm">{customer.addresses.map((address: any) => <li key={address.id} className="border-b border-line py-2">{address.line1}, {address.city}, {address.region}</li>)}</ul>
      <h2 className="mt-8 font-serif text-2xl">Data requests</h2>
      {customer.dataRequests.map((request: any) => (
        <div key={request.id} className="mt-3 border border-line p-3 text-sm">
          <p>{request.type.toLowerCase()} · {request.status.toLowerCase()}</p>
          {request.status === "PENDING" ? (
            <AdminForm action={resolveDataRequest} submit="Apply decision">
              <input type="hidden" name="id" value={request.id} />
              <Label>Decision
                <select name="decision" className="w-full rounded-full border border-line bg-white px-4 py-2">
                  <option value="complete">Complete</option>
                  <option value="reject">Reject</option>
                </select>
              </Label>
              </AdminForm>
          ) : null}
        </div>
      ))}
    </main>
  );
}
