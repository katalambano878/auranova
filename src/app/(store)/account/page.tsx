import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { isStaffRole } from "@/server/permissions";
import { SignOut } from "@/components/account/sign-out";
import { PageIntro } from "@/components/store/page-intro";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/account/login");
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title={`Hello, ${session.user.name}`} body={session.user.email} />
      <nav className="mt-10 grid max-w-3xl gap-4 text-sm sm:grid-cols-2">
        <Link className="rounded-[1.5rem] bg-mist p-6 font-serif text-2xl hover:bg-sage" href="/account/orders">Orders</Link>
        <Link className="rounded-[1.5rem] bg-mist p-6 font-serif text-2xl hover:bg-sage" href="/account/addresses">Addresses</Link>
        <Link className="rounded-[1.5rem] bg-mist p-6 font-serif text-2xl hover:bg-sage" href="/wishlist">Saved</Link>
        <Link className="rounded-[1.5rem] bg-mist p-6 font-serif text-2xl hover:bg-sage" href="/account/security">Security</Link>
        {isStaffRole(session.user.role) ? <Link className="rounded-[1.5rem] bg-forest p-6 font-serif text-2xl text-white" href="/admin">Admin</Link> : null}
      </nav>
      <SignOut />
    </main>
  );
}
