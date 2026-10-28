import { redirect } from "next/navigation";
import { AddressBook } from "@/components/account/address-book";
import { supabaseAdmin, throwIf } from "@/server/db";
import { getSession } from "@/server/session";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const session = await getSession();
  if (!session) redirect("/account/login");
  const { data: addresses, error } = await supabaseAdmin().from("Address").select("*").eq("userId", session.user.id).order("isDefault", { ascending: false });
  throwIf(error);
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Addresses" />
      <div className="mt-10 max-w-3xl">
      <AddressBook addresses={addresses || []} />
      </div>
    </main>
  );
}
