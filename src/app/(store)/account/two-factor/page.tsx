import Link from "next/link";
import { PageIntro } from "@/components/store/page-intro";

export default function TwoFactorPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Sign-in" body="Accounts sign in with email and password through Supabase." />
      <p className="mt-8"><Link href="/account/security" className="underline">Change your password</Link></p>
    </main>
  );
}
