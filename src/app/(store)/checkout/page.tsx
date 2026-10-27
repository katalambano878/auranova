import { cookies } from "next/headers";
import { CheckoutForm } from "@/components/store/checkout-form";
import { PageIntro } from "@/components/store/page-intro";
import { getSession } from "@/server/session";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await getSession();
  const jar = await cookies();
  const addresses = session
    ? await prisma.address.findMany({ where: { userId: session.user.id }, orderBy: { isDefault: "desc" } })
    : [];
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Checkout" title="Checkout" body="Guest checkout is open. Prices, delivery, and stock are checked again on the server." />
      <div className="mt-10 max-w-2xl rounded-[2rem] bg-mist p-6 md:p-8">
        <CheckoutForm coupon={jar.get("auranova_coupon")?.value || ""} addresses={addresses} />
      </div>
    </main>
  );
}
