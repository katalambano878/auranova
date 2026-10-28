import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { supabaseAdmin, throwIf } from "@/server/db";
import { getSession } from "@/server/session";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/account/login");
  const { data: orders, error } = await supabaseAdmin().from("Order").select("*").eq("userId", session.user.id).order("createdAt", { ascending: false });
  throwIf(error);
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Orders" />
      {(orders || []).length === 0 ? <p className="mt-8 text-stone">No orders on this account yet.</p> : (
        <ul className="mt-10 max-w-3xl space-y-3">
          {(orders || []).map((order) => (
            <li key={order.id} className="flex items-center justify-between rounded-[1.5rem] bg-mist px-5 py-4">
              <div>
                <Link href={`/account/orders/${order.number}`} className="font-medium underline">{order.number}</Link>
                <p className="text-sm text-stone">{order.paymentStatus.toLowerCase()} · {order.fulfilmentStatus.toLowerCase().replaceAll("_", " ")}</p>
              </div>
              <p>{formatMoney(order.total, order.currency)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
