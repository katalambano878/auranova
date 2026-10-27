import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/account/auth-form";
import { PageIntro } from "@/components/store/page-intro";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <PageIntro eyebrow="Account" title="Sign in" />
      <div className="mt-10 max-w-md rounded-[2rem] bg-mist p-8"><Suspense><AuthForm mode="login" /></Suspense></div>
      <p className="mt-4 text-sm"><Link href="/account/register" className="underline">Create an account</Link> · <Link href="/account/forgot-password" className="underline">Forgot password</Link></p>
    </main>
  );
}
