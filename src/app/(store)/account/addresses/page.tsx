import { redirect } from "next/navigation";
import { AddressBook } from "@/components/account/address-book";
import { prisma } from "@/server/db";
import { getSession } from "@/server/session";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const session = await getSession();
  if (!session) redirect("/account/login");
  const addresses = await prisma.address.findMany({ where: { userId: session.user.id }, orderBy: { isDefault: "desc" } });
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Addresses" />
      <div className="mt-10 max-w-3xl">
      <AddressBook addresses={addresses} />
      </div>
    </main>
  );
}
