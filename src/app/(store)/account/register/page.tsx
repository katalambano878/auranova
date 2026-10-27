import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/account/auth-form";
import { PageIntro } from "@/components/store/page-intro";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Create an account" body="Customer accounts cannot become staff accounts from this form." />
      <div className="mt-10 max-w-md rounded-[2rem] bg-mist p-8"><Suspense><AuthForm mode="register" /></Suspense></div>
      <p className="mt-4 text-sm"><Link href="/account/login" className="underline">Already registered</Link></p>
    </main>
  );
}
